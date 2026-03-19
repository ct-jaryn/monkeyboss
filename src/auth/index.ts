import { Page } from 'playwright';
import { Config } from '../config';
import { logger } from '../utils/logger';

export class MonkeyCodeAuth {
  private config: Config;
  private authenticated = false;

  constructor(config: Config) {
    this.config = config;
  }

  /**
   * Login to MonkeyCode platform.
   * Navigates to login page, fills credentials, and waits for redirect.
   */
  async login(page: Page): Promise<void> {
    const loginUrl = `${this.config.monkeycode.url}/login`;
    logger.info(`Logging in to MonkeyCode: ${loginUrl}`);

    await page.goto(loginUrl, { waitUntil: 'networkidle' });

    // Wait for login form to appear
    await page.waitForSelector('input[type="text"], input[type="email"], input[name="username"]', {
      timeout: 15000,
    });

    // Fill username - try common selectors
    const usernameInput = await page.$(
      'input[name="username"], input[type="email"], input[placeholder*="email"], input[placeholder*="username"]'
    );
    if (usernameInput) {
      await usernameInput.fill(this.config.monkeycode.username);
    } else {
      throw new Error('Cannot find username input field on login page');
    }

    // Fill password
    const passwordInput = await page.$(
      'input[type="password"], input[name="password"]'
    );
    if (passwordInput) {
      await passwordInput.fill(this.config.monkeycode.password);
    } else {
      throw new Error('Cannot find password input field on login page');
    }

    // Click login button
    const loginButton = await page.$(
      'button[type="submit"], button:has-text("Login"), button:has-text("Sign in"), button:has-text("登录")'
    );
    if (loginButton) {
      await loginButton.click();
    } else {
      throw new Error('Cannot find login button on login page');
    }

    // Wait for navigation after login
    await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 });

    // Verify login success by checking URL changed away from login page
    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      throw new Error('Login failed: still on login page after submission');
    }

    this.authenticated = true;
    logger.info('Successfully logged in to MonkeyCode');
  }

  /**
   * Check if current session is still authenticated.
   */
  async checkSession(page: Page): Promise<boolean> {
    try {
      const currentUrl = page.url();
      // If redirected to login page, session expired
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

  /**
   * Re-authenticate if session expired.
   */
  async ensureAuthenticated(page: Page): Promise<void> {
    const isValid = await this.checkSession(page);
    if (!isValid) {
      logger.warn('Session expired, re-authenticating...');
      await this.login(page);
    }
  }

  isAuthenticated(): boolean {
    return this.authenticated;
  }
}
