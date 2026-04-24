const puppeteer = require('puppeteer');
const logger = require('./logger');
const path = require('path');

class BrowserManager {
  constructor() {
    this.browser = null;
    this.searchPage = null;
    this.linkPage = null;
    this.status = 'disconnected';
    this.subscribers = new Set();
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  _broadcast() {
    const status = this.getStatus();
    for (const cb of this.subscribers) {
      try { cb(status); } catch {}
    }
  }

  async launch() {
    try {
      this.status = 'launching';
      this._broadcast();
      logger.info('Browser', 'Launching Chrome...');

      // Load puppeteer stealth to bypass bot detection if any
      const puppeteerExtra = require('puppeteer-extra');
      const StealthPlugin = require('puppeteer-extra-plugin-stealth');
      puppeteerExtra.use(StealthPlugin());

      this.browser = await puppeteerExtra.launch({
        headless: false,
        userDataDir: path.join(__dirname, '..', 'chrome_profile'),
        defaultViewport: null,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--window-size=1200,800'
        ],
      });

      this.browser.on('disconnected', () => {
        this.status = 'disconnected';
        logger.warn('Browser', 'Chrome disconnected');
        this._broadcast();
      });

      const pages = await this.browser.pages();
      this.searchPage = pages[0] || await this.browser.newPage();
      this.linkPage = await this.browser.newPage();

      logger.info('Browser', 'Navigating to Shopee Affiliate pages...');

      await this.searchPage.goto('https://affiliate.shopee.vn/offer/product_offer', {
        waitUntil: 'networkidle2',
        timeout: 60000,
      });

      await this.linkPage.goto('https://affiliate.shopee.vn/offer/custom_link', {
        waitUntil: 'networkidle2',
        timeout: 60000,
      });

      this.status = 'ready';
      logger.info('Browser', 'Chrome ready — both tabs loaded');
      this._broadcast();
      return true;
    } catch (err) {
      this.status = 'error';
      logger.error('Browser', `Launch failed: ${err.message}`);
      this._broadcast();
      return false;
    }
  }

  async reloadPages() {
    if (!this.browser) {
      logger.error('Browser', 'Cannot reload — browser not launched');
      return;
    }

    this.status = 'reloading';
    this._broadcast();
    logger.info('Browser', 'Reloading pages...');

    try {
      if (this.searchPage) {
        await this.searchPage.reload({ waitUntil: 'networkidle2', timeout: 30000 });
      }
      if (this.linkPage) {
        await this.linkPage.reload({ waitUntil: 'networkidle2', timeout: 30000 });
      }
      this.status = 'ready';
      logger.info('Browser', 'Pages reloaded successfully');
    } catch (err) {
      this.status = 'error';
      logger.error('Browser', `Reload failed: ${err.message}`);
    }
    this._broadcast();
  }

  async checkSession() {
    if (!this.searchPage) return false;
    try {
      const cookies = await this.searchPage.cookies();
      const hasSPC = cookies.some(c => c.name === 'SPC_EC');
      return hasSPC;
    } catch {
      return false;
    }
  }

  getStatus() {
    return {
      status: this.status,
      hasSearchPage: !!this.searchPage,
      hasLinkPage: !!this.linkPage,
    };
  }

  getSearchPage() {
    return this.searchPage;
  }

  getLinkPage() {
    return this.linkPage;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.status = 'disconnected';
      this._broadcast();
    }
  }
}

module.exports = new BrowserManager();
