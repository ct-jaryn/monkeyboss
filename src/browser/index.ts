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

  async launch(): Promise<void> {
    logger.info('正在启动浏览器（隐私模式）...');
    this.browser = await chromium.launch({
      headless: this.config.browser.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent:
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ignoreHTTPSErrors: true,
    });

    this.context.setDefaultTimeout(this.config.browser.timeout);
    this.page = await this.context.newPage();
    logger.info('浏览器启动成功（隐私上下文）');
  }

  getPage(): Page {
    if (!this.page) throw new Error('浏览器未启动，请先调用 launch()');
    return this.page;
  }

  getContext(): BrowserContext {
    if (!this.context) throw new Error('浏览器未启动，请先调用 launch()');
    return this.context;
  }

  async navigate(url: string): Promise<void> {
    const page = this.getPage();
    logger.info(`正在导航至: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle' });
    logger.info(`页面已加载: ${await page.title()}`);
  }

  async screenshot(path?: string): Promise<Buffer> {
    const page = this.getPage();
    const buffer = await page.screenshot({
      path,
      fullPage: true,
      type: 'png',
    });
    if (path) logger.info(`截图已保存: ${path}`);
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
    logger.info('浏览器已关闭');
  }

  isAlive(): boolean {
    return this.browser !== null && this.browser.isConnected();
  }

  async ensureAlive(): Promise<void> {
    if (!this.isAlive()) {
      logger.warn('浏览器已断开连接，正在重启...');
      await this.close();
      await this.launch();
    }
  }
}
