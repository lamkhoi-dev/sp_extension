const db = require('../zalo/database');
const logger = require('../logger');

const stmts = {
  upsert: db.prepare(`
    INSERT OR REPLACE INTO product_images (item_id, shop_id, img_code)
    VALUES (@itemId, @shopId, @imgCode)
  `),

  getByItemId: db.prepare(`SELECT img_code FROM product_images WHERE item_id = ?`),

  getBatch: db.prepare(`
    SELECT item_id, img_code FROM product_images
    WHERE item_id IN (${Array(50).fill('?').join(',')})
  `),

  getAll: db.prepare(`SELECT item_id, img_code FROM product_images`),

  getCount: db.prepare(`SELECT COUNT(*) as count FROM product_images`),

  getMissingItems: db.prepare(`
    SELECT DISTINCT o.item_id, o.shop_id FROM orders o
    LEFT JOIN product_images pi ON o.item_id = pi.item_id
    WHERE pi.item_id IS NULL AND o.item_id != ''
    LIMIT ?
  `),
};

const bulkInsert = db.transaction((records) => {
  let inserted = 0;
  for (const r of records) {
    try {
      stmts.upsert.run({ itemId: String(r.item_id), shopId: String(r.shop_id || ''), imgCode: r.img_code });
      inserted++;
    } catch (err) {
      logger.warn('ProductImageStore', `Upsert failed for item ${r.item_id}: ${err.message}`);
    }
  }
  return inserted;
});

const productImageStore = {
  save(itemId, shopId, imgCode) {
    try {
      stmts.upsert.run({ itemId: String(itemId), shopId: String(shopId || ''), imgCode });
      return true;
    } catch (err) {
      logger.error('ProductImageStore', `Save failed: ${err.message}`);
      return false;
    }
  },

  bulkSave(records) {
    if (!records || records.length === 0) return 0;
    return bulkInsert(records);
  },

  getImgCode(itemId) {
    const row = stmts.getByItemId.get(String(itemId));
    return row ? row.img_code : null;
  },

  getImgMap(itemIds) {
    if (!itemIds || itemIds.length === 0) return {};
    const allRows = stmts.getAll.all();
    const idSet = new Set(itemIds.map(String));
    const map = {};
    for (const row of allRows) {
      if (idSet.has(row.item_id)) {
        map[row.item_id] = row.img_code;
      }
    }
    return map;
  },

  getCount() {
    return stmts.getCount.get().count;
  },

  getMissingItems(limit = 100) {
    return stmts.getMissingItems.all(limit);
  },
};

module.exports = productImageStore;
