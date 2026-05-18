const db = require('../db');
const logger = require('../logger');

const productImageStore = {
  async save(itemId, shopId, imgCode) {
    try {
      await db.runNamed(`
        INSERT INTO product_images (item_id, shop_id, img_code)
        VALUES (@itemId, @shopId, @imgCode)
        ON CONFLICT(item_id) DO UPDATE SET
          shop_id = @shopId,
          img_code = @imgCode,
          cached_at = datetime('now','localtime')
      `, { itemId: String(itemId), shopId: String(shopId || ''), imgCode });
      return true;
    } catch (err) {
      logger.error('ProductImageStore', `Save failed: ${err.message}`);
      return false;
    }
  },

  async bulkSave(records) {
    if (!records || records.length === 0) return 0;

    let inserted = 0;
    await db.transaction(async (tx) => {
      for (const r of records) {
        try {
          await tx.runNamed(`
            INSERT INTO product_images (item_id, shop_id, img_code)
            VALUES (@itemId, @shopId, @imgCode)
            ON CONFLICT(item_id) DO UPDATE SET
              shop_id = @shopId,
              img_code = @imgCode,
              cached_at = datetime('now','localtime')
          `, { itemId: String(r.item_id), shopId: String(r.shop_id || ''), imgCode: r.img_code });
          inserted++;
        } catch (err) {
          logger.warn('ProductImageStore', `Upsert failed for item ${r.item_id}: ${err.message}`);
        }
      }
    });
    return inserted;
  },

  async getImgCode(itemId) {
    const row = await db.get('SELECT img_code FROM product_images WHERE item_id = ?', [String(itemId)]);
    return row ? row.img_code : null;
  },

  async getImgMap(itemIds) {
    if (!itemIds || itemIds.length === 0) return {};
    const allRows = await db.all('SELECT item_id, img_code FROM product_images');
    const idSet = new Set(itemIds.map(String));
    const map = {};
    for (const row of allRows) {
      if (idSet.has(row.item_id)) {
        map[row.item_id] = row.img_code;
      }
    }
    return map;
  },

  async getCount() {
    const row = await db.get('SELECT COUNT(*) as count FROM product_images');
    return row.count;
  },

  async getMissingItems(limit = 100) {
    return db.all(`
      SELECT DISTINCT o.item_id, o.shop_id FROM orders o
      LEFT JOIN product_images pi ON o.item_id = pi.item_id
      WHERE pi.item_id IS NULL AND o.item_id != ''
      LIMIT ?
    `, [limit]);
  },
};

module.exports = productImageStore;
