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

    // Format 3: https://s.shopee.vn/{code} (short link)
    const shortMatch = url.match(/s\.shopee\.vn\/([a-zA-Z0-9]+)/);
    if (shortMatch) {
      return { shortCode: shortMatch[1], type: 'short' };
    }

    // Format 4: https://shopee.vn/universal-link/product/{shopId}/{itemId}
    const universalMatch = url.match(/universal-link\/product\/(\d+)\/(\d+)/);
    if (universalMatch) {
      return { shopId: universalMatch[1], itemId: universalMatch[2], type: 'universal' };
    }

    // Generic: any shopee.vn link (for Custom Link support)
    if (url.includes('shopee.vn')) {
      return { type: 'generic' };
    }

    return null;
  }
}

module.exports = ShopeeAPI;
