import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { Config } from '../config';
import { logger } from '../utils/logger';

export class BrowserEngine {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  /**
   * Launch browser in incognito (private) mode.
   * Uses a fresh BrowserContext with no persistent storage.
   */
  async launch(): Promise<void> {
    logger.info('Launching browser in incognito mode...');
    this.browser = await chromium.launch({
      headless: this.config.browser.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    });

    // Incognito context: no cookies, no cache, no storage carried over
    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent:
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ignoreHTTPSErrors: true,
    });

    this.context.setDefaultTimeout(this.config.browser.timeout);
    this.page = await this.context.newPage();
    logger.info('Browser launched successfully (incognito context)');
  }

  getPage(): Page {
    if (!this.page) throw new Error('Browser not launched. Call launch() first.');
    return this.page;
  }

  getContext(): BrowserContext {
    if (!this.context) throw new Error('Browser not launched. Call launch() first.');
    return this.context;
  }

  async navigate(url: string): Promise<void> {
    const page = this.getPage();
    logger.info(`Navigating to: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle' });
    logger.info(`Page loaded: ${await page.title()}`);
  }

  async screenshot(path?: string): Promise<Buffer> {
    const page = this.getPage();
    const buffer = await page.screenshot({
      path,
      fullPage: true,
      type: 'png',
    });
    if (path) logger.info(`Screenshot saved: ${path}`);
    return buffer;
  }

  async close(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
      this.page = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    logger.info('Browser closed');
  }

  isAlive(): boolean {
    return this.browser !== null && this.browser.isConnected();
  }

  /**
   * Restart browser if it crashed or disconnected.
   */
  async ensureAlive(): Promise<void> {
    if (!this.isAlive()) {
      logger.warn('Browser disconnected, restarting...');
      await this.close();
      await this.launch();
    }
  }
}
