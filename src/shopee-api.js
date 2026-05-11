const logger = require('./logger');

class ShopeeAPI {
  // Generate unique request ID
  static genReqId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  async searchProduct(keyword) {
    if (!ShopeeAPI.sendToExtension) {
      throw new Error('Extension chưa kết nối.');
    }

    const startTime = Date.now();
    logger.info('ShopeeAPI', `Searching: "${keyword}"`);

    try {
      const reqId = ShopeeAPI.genReqId();
      const result = await ShopeeAPI.sendToExtension(reqId, {
        action: 'search_product',
        payload: { keyword },
      });

      const duration = Date.now() - startTime;
      logger.info('ShopeeAPI', `Search completed in ${duration}ms`);

      if (!result.success) {
        return { success: false, error: result.error };
      }

      return {
        success: true,
        items: result.items || [],
        totalCount: result.totalCount || 0,
        keyword,
      };
    } catch (err) {
      logger.error('ShopeeAPI', `Search error: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  async convertLink(originalLink, subIds = {}) {
    if (!ShopeeAPI.sendToExtension) {
      throw new Error('Extension chưa kết nối.');
    }

    const startTime = Date.now();
    logger.info('ShopeeAPI', `Converting: ${originalLink.slice(0, 60)}...`);

    try {
      const reqId = ShopeeAPI.genReqId();
      const result = await ShopeeAPI.sendToExtension(reqId, {
        action: 'convert_link',
        payload: {
          url: originalLink,
          subId1: subIds.subId1 || '',
          subId2: subIds.subId2 || '',
        },
      });

      const duration = Date.now() - startTime;
      logger.info('ShopeeAPI', `Link converted in ${duration}ms: ${result.shortLink}`);

      return {
        success: true,
        shortLink: result.shortLink,
        originalLink,
      };
    } catch (err) {
      logger.error('ShopeeAPI', `Convert error: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  async checkAndConvert(originalLink, subIds = {}, productHint = null) {
    if (!ShopeeAPI.sendToExtension) {
      throw new Error('Extension chưa kết nối.');
    }

    const startTime = Date.now();
    logger.info('ShopeeAPI', `Check & Convert: ${originalLink.slice(0, 60)}...`);

    try {
      const reqId = ShopeeAPI.genReqId();
      const result = await ShopeeAPI.sendToExtension(reqId, {
        action: 'check_and_convert',
        payload: {
          url: originalLink,
          productHint: productHint || null,
          subIds: {
            sub1: subIds.sub1 || 'sub1',
            sub2: subIds.sub2 || 'sub2',
            sub3: subIds.sub3 || 'sub3',
          },
        },
      });

      const duration = Date.now() - startTime;

      if (result.noCommission) {
        logger.info('ShopeeAPI', `No commission for link (${duration}ms)`);
        return { success: false, noCommission: true };
      }

      if (!result.success) {
        logger.warn('ShopeeAPI', `Check failed (${duration}ms): ${result.error}`);
        return { success: false, error: result.error };
      }

      const src = result.source || 'shopee';
      logger.info('ShopeeAPI', `✅ Commission found: ${result.commission}% [${src}] → ${result.shortLink} (${duration}ms)`);
      return {
        success: true,
        shortLink: result.shortLink,
        productName: result.productName,
        commission: result.commission,
        commissionAmount: result.commissionAmount,
        price: result.price,
        source: src,
        originalLink,
        itemId: result.itemId || '',
        shopId: result.shopId || '',
      };
    } catch (err) {
      logger.error('ShopeeAPI', `Check & Convert error: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  parseShopeeLink(url) {
    // Format 1: https://shopee.vn/product/{shopId}/{itemId}?...
    const productMatch = url.match(/shopee\.vn\/product\/(\d+)\/(\d+)/);
    if (productMatch) {
      return { shopId: productMatch[1], itemId: productMatch[2], type: 'product' };
    }

    // Format 2: https://shopee.vn/{name}-i.{shopId}.{itemId}
    const nameMatch = url.match(/shopee\.vn\/.*-i\.(\d+)\.(\d+)/);
    if (nameMatch) {
      return { shopId: nameMatch[1], itemId: nameMatch[2], type: 'named' };
    }

    // Format 3: https://s.shopee.vn/{code} or https://vn.shp.ee/{code} (short link)
    const shortMatch = url.match(/(?:s\.shopee\.vn|vn\.shp\.ee)\/([a-zA-Z0-9]+)/);
    if (shortMatch) {
      return { shortCode: shortMatch[1], type: 'short' };
    }

    // Format 4: https://shopee.vn/universal-link/product/{shopId}/{itemId}
    const universalMatch = url.match(/universal-link\/product\/(\d+)\/(\d+)/);
    if (universalMatch) {
      return { shopId: universalMatch[1], itemId: universalMatch[2], type: 'universal' };
    }

    // Format 5: https://affiliate.shopee.vn/offer/product_offer/{itemId}
    const affiliateMatch = url.match(/affiliate\.shopee\.vn\/offer\/product_offer\/(\d+)/);
    if (affiliateMatch) {
      return { itemId: affiliateMatch[1], type: 'affiliate' };
    }

    // Generic: any shopee.vn link (for Custom Link support)
    if (url.includes('shopee.vn') || url.includes('shp.ee')) {
      return { type: 'generic' };
    }

    return null;
  }
}

module.exports = ShopeeAPI;
