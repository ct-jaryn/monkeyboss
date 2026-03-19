import { Page } from 'playwright';
import { Config } from '../config';
import { logger } from '../utils/logger';

export class MonkeyCodeAuth {
  private config: Config;
  private authenticated = false;

  constructor(config: Config) {
    this.config = config;
  }

  async login(page: Page): Promise<void> {
    const loginUrl = `${this.config.monkeycode.url}/login`;
    logger.info(`正在登录 MonkeyCode: ${loginUrl}`);

    await page.goto(loginUrl, { waitUntil: 'networkidle' });

    await page.waitForSelector('input[type="text"], input[type="email"], input[name="username"]', {
      timeout: 15000,
    });

    const usernameInput = await page.$(
      'input[name="username"], input[type="email"], input[placeholder*="email"], input[placeholder*="username"]'
    );
    if (usernameInput) {
      await usernameInput.fill(this.config.monkeycode.username);
    } else {
      throw new Error('无法找到用户名输入框');
    }

    const passwordInput = await page.$(
      'input[type="password"], input[name="password"]'
    );
    if (passwordInput) {
      await passwordInput.fill(this.config.monkeycode.password);
    } else {
      throw new Error('无法找到密码输入框');
    }

    const loginButton = await page.$(
      'button[type="submit"], button:has-text("Login"), button:has-text("Sign in"), button:has-text("登录")'
    );
    if (loginButton) {
      await loginButton.click();
    } else {
      throw new Error('无法找到登录按钮');
    }

    await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 });

    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      throw new Error('登录失败：提交后仍停留在登录页面');
    }

    this.authenticated = true;
    logger.info('已成功登录 MonkeyCode');
  }

  async checkSession(page: Page): Promise<boolean> {
    try {
      const currentUrl = page.url();
      if (currentUrl.includes('/login')) {
        this.authenticated = false;
        return false;
      }
      return true;
    } catch {
      this.authenticated = false;
      return false;
    }
  }

  async ensureAuthenticated(page: Page): Promise<void> {
    const isValid = await this.checkSession(page);
    if (!isValid) {
      logger.warn('会话已过期，正在重新认证...');
      await this.login(page);
    }
  }

  isAuthenticated(): boolean {
    return this.authenticated;
  }
}
