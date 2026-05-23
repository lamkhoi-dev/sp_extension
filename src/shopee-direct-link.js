const logger = require('./logger');

// Tracking params to strip from product URLs before generating affiliate links
const TRACKING_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'gads_t_sig', 'gclid', 'fbclid', 'twclid', 'msclkid',
  'affiliate_id', 'sub_id', 'subid', 'subId',
  'credential_token', 'mmp_pid', 'uls_trackid',
  'is_from_login', 'xptdk', '__mobile__', 'exp_group',
];

class ShopeeDirectLink {
  constructor(affiliateId) {
    this.affiliateId = affiliateId;
    if (!affiliateId) {
      logger.warn('ShopeeDirectLink', 'SHOPEE_AFFILIATE_ID not set — direct link generation will fail');
    }
  }

  /**
   * Parse shopId + itemId from various Shopee URL formats
   */
  static parseProductUrl(url) {
    if (!url || typeof url !== 'string') return null;

    // Format: /product/{shopId}/{itemId}
    const productMatch = url.match(/shopee\.vn\/product\/(\d+)\/(\d+)/);
    if (productMatch) return { shopId: productMatch[1], itemId: productMatch[2] };

    // Format: /{name}-i.{shopId}.{itemId}
    const nameMatch = url.match(/shopee\.vn\/.*-i\.(\d+)\.(\d+)/);
    if (nameMatch) return { shopId: nameMatch[1], itemId: nameMatch[2] };

    // Format: /universal-link/product/{shopId}/{itemId}
    const uniMatch = url.match(/universal-link\/product\/(\d+)\/(\d+)/);
    if (uniMatch) return { shopId: uniMatch[1], itemId: uniMatch[2] };

    // Format: affiliate offer page
    const affMatch = url.match(/affiliate\.shopee\.vn\/offer\/product_offer\/(\d+)/);
    if (affMatch) return { itemId: affMatch[1] };

    // Format: /{encoded_path}/{shopId}/{itemId} (e.g. /opaanlp/812449960/21532544326)
    // Shopee sometimes uses random/encoded path prefixes instead of /product/
    const genericPathMatch = url.match(/shopee\.vn\/[^/]+\/(\d{5,})\/(\d{5,})/);
    if (genericPathMatch) return { shopId: genericPathMatch[1], itemId: genericPathMatch[2] };

    // Format: /{shop_slug}/{itemId} — slug may contain letters (e.g. /ecoshop6868/24189784914)
    // This is what s.shopee.vn short links resolve to for shop-branded URLs
    const shopSlugMatch = url.match(/shopee\.vn\/[^/?\s]+\/(\d{8,})/);
    if (shopSlugMatch) return { itemId: shopSlugMatch[1] };

    // Fallback: item_id in query string (e.g. ?item_id=123)
    try {
      const itemIdParam = new URL(url).searchParams.get('item_id');
      if (itemIdParam && /^\d+$/.test(itemIdParam)) return { itemId: itemIdParam };
    } catch {}

    return null;

  }

  /**
   * Remove tracking params from URL to get a clean product link
   */
  static cleanUrl(url) {
    try {
      const parsed = new URL(url);
      TRACKING_PARAMS.forEach((p) => parsed.searchParams.delete(p));
      return parsed.toString();
    } catch {
      return url;
    }
  }

  /**
   * Build sub_id string from subIds object
   * Format: sub1-sub2-sub3-sub4-sub5 (joined by -)
   * Skips values that contain '-' to avoid parsing issues
   */
  static buildSubIdString(subIds = {}) {
    const parts = [
      subIds.sub1 || '',
      subIds.sub2 || '',
      subIds.sub3 || '',
      subIds.sub4 || '',
      subIds.sub5 || '',
    ];
    return parts.filter((v) => v && !String(v).includes('-')).join('-');
  }

  /**
   * Resolve short links (s.shopee.vn, vn.shp.ee) to full product URLs
   */
  async resolveShortLink(url) {
    if (!url.includes('s.shopee.vn/') && !url.includes('vn.shp.ee/')) {
      return url;
    }

    // Skip an_redir URLs — they are already affiliate links, not short links
    if (url.includes('an_redir')) return url;

    try {
      const resp = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        },
      });
      const finalUrl = resp.url;
      if (finalUrl.includes('shopee.vn')) {
        logger.info('ShopeeDirectLink', `Resolved short link → ${finalUrl.slice(0, 80)}`);
        return finalUrl;
      }
    } catch (err) {
      logger.warn('ShopeeDirectLink', `Short link resolve failed: ${err.message}`);
    }
    return url;
  }

  /**
   * Generate an_redir affiliate link (headless, no browser needed)
   */
  generateLink(productUrl, subIds = {}) {
    if (!this.affiliateId) {
      return { success: false, error: 'SHOPEE_AFFILIATE_ID chưa được cấu hình' };
    }

    const cleanedUrl = ShopeeDirectLink.cleanUrl(productUrl);
    const subIdString = ShopeeDirectLink.buildSubIdString(subIds);

    let affiliateLink = `https://s.shopee.vn/an_redir?origin_link=${encodeURIComponent(cleanedUrl)}&affiliate_id=${this.affiliateId}`;
    if (subIdString) {
      affiliateLink += `&sub_id=${subIdString}`;
    }

    return {
      success: true,
      affiliateLink,
      shortLink: affiliateLink, // For compatibility — callers expect shortLink
      originalLink: productUrl,
      source: 'direct',
    };
  }

  /**
   * Check product commission via addlivetag API
   * Same API the extension uses (background.js:437 fetchAddlivetagCommission)
   */
  async checkCommission(itemId) {
    if (!itemId) return { found: false };

    try {
      const resp = await fetch(
        `https://data.addlivetag.com/product-data/product-data.php?item_id=${itemId}`,
        {
          method: 'GET',
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(10000),
        },
      );

      if (!resp.ok) return { found: false, error: `HTTP ${resp.status}` };

      const data = await resp.json();
      if (data.status === 'success' && data.productInfo?.commission > 0) {
        const info = data.productInfo;
        const rate = info.price > 0
          ? Math.round((info.commission / info.price) * 10000) / 100
          : 0;
        return {
          found: true,
          commission: rate,
          commissionAmount: info.commission,
          productName: info.productName || '',
          price: info.price || 0,
          shopName: info.shopName || '',
          source: 'addlivetag',
        };
      }

      return { found: false };
    } catch (err) {
      logger.warn('ShopeeDirectLink', `Commission check failed: ${err.message}`);
      return { found: false, error: err.message };
    }
  }

  /**
   * Full pipeline: resolve short link → parse → check commission → generate link
   */
  async checkAndGenerate(productUrl, subIds = {}) {
    const startTime = Date.now();
    const isAnRedir = productUrl.includes('an_redir');

    // 0. If an_redir link, extract origin_link for parsing
    let resolvedUrl = productUrl;
    if (isAnRedir) {
      try {
        const parsed = new URL(productUrl);
        const originLink = parsed.searchParams.get('origin_link');
        if (!originLink) {
          throw new Error('Không tìm thấy origin_link trong URL an_redir');
        }
        resolvedUrl = decodeURIComponent(originLink);
        logger.info('ShopeeDirectLink', `Extracted origin_link from an_redir → ${resolvedUrl.slice(0, 80)}`);
      } catch (err) {
        logger.error('ShopeeDirectLink', `Failed to parse an_redir URL: ${err.message}`);
        throw new Error(`Lỗi giải mã link an_redir: ${err.message}`);
      }
    } else {
      // 1. Resolve short links (only for non-an_redir URLs)
      resolvedUrl = await this.resolveShortLink(productUrl);
    }

    // 2. Parse product info
    const parsed = ShopeeDirectLink.parseProductUrl(resolvedUrl);
    if (!parsed) {
      // Still try to generate link even without parsed info (generic shopee link)
      if (resolvedUrl.includes('shopee.vn') || resolvedUrl.includes('shp.ee')) {
        const result = this.generateLink(resolvedUrl, subIds);
        const duration = Date.now() - startTime;
        logger.info('ShopeeDirectLink', `Generic link generated in ${duration}ms (no commission data)`);
        return {
          ...result,
          productName: '',
          commission: 0,
          commissionAmount: 0,
          price: '',
          itemId: '',
          shopId: '',
          source: 'direct',
        };
      }
      return { success: false, error: 'Không parse được URL sản phẩm' };
    }

    // 3. Check commission (parallel-safe, no browser needed)
    let commissionData = { found: false };
    if (parsed.itemId) {
      commissionData = await this.checkCommission(parsed.itemId);
    }

    // 4. No commission → still generate link but flag it
    if (commissionData.found === false) {
      const result = this.generateLink(resolvedUrl, subIds);
      const duration = Date.now() - startTime;
      logger.info('ShopeeDirectLink', `Link generated in ${duration}ms (no commission data)`);
      return {
        ...result,
        productName: '',
        commission: 0,
        commissionAmount: 0,
        price: '',
        itemId: parsed.itemId || '',
        shopId: parsed.shopId || '',
        source: 'direct',
      };
    }

    // 5. Has commission → update subId3 with rate, generate link
    const enrichedSubIds = {
      ...subIds,
      sub3: String(commissionData.commission || subIds.sub3 || ''),
    };
    const result = this.generateLink(resolvedUrl, enrichedSubIds);
    const duration = Date.now() - startTime;

    const priceFormatted = commissionData.price
      ? new Intl.NumberFormat('vi-VN').format(commissionData.price) + '₫'
      : '';

    logger.info('ShopeeDirectLink', `✅ ${commissionData.commission}% → ${result.affiliateLink.slice(0, 60)}... (${duration}ms)`);

    return {
      ...result,
      productName: commissionData.productName || '',
      commission: commissionData.commission || 0,
      commissionAmount: commissionData.commissionAmount || 0,
      price: priceFormatted,
      itemId: parsed.itemId || '',
      shopId: parsed.shopId || '',
      source: 'direct',
    };
  }
}

module.exports = ShopeeDirectLink;
