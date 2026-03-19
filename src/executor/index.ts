import { Page } from 'playwright';
import { AIAction } from '../ai';
import { logger } from '../utils/logger';

export class ActionExecutor {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Execute a list of AI-decided actions sequentially.
   */
  async executeAll(actions: AIAction[]): Promise<void> {
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      logger.info(`Executing action [${i + 1}/${actions.length}]: ${action.type} - ${action.reason}`);
      try {
        await this.execute(action);
        // Small delay between actions for page stability
        await this.page.waitForTimeout(500);
      } catch (error) {
        logger.error(`Action failed [${action.type}]: ${error}`);
        // Continue with next action instead of stopping entirely
      }
    }
  }

  private async execute(action: AIAction): Promise<void> {
    switch (action.type) {
      case 'click':
        await this.handleClick(action);
        break;
      case 'fill':
        await this.handleFill(action);
        break;
      case 'type':
        await this.handleType(action);
        break;
      case 'navigate':
        await this.handleNavigate(action);
        break;
      case 'wait':
        await this.handleWait(action);
        break;
      case 'scroll':
        await this.handleScroll(action);
        break;
      case 'send_message':
        await this.handleSendMessage(action);
        break;
      case 'done':
        logger.info('AI signaled project completion');
        break;
      default:
        logger.warn(`Unknown action type: ${action.type}`);
    }
  }

  private async handleClick(action: AIAction): Promise<void> {
    if (!action.selector) throw new Error('Click action requires a selector');
    await this.page.waitForSelector(action.selector, { timeout: 10000 });
    await this.page.click(action.selector);
    logger.info(`Clicked: ${action.selector}`);
  }

  private async handleFill(action: AIAction): Promise<void> {
    if (!action.selector) throw new Error('Fill action requires a selector');
    if (action.value === undefined) throw new Error('Fill action requires a value');
    await this.page.waitForSelector(action.selector, { timeout: 10000 });
    await this.page.fill(action.selector, action.value);
    logger.info(`Filled "${action.selector}" with ${action.value.length} chars`);
  }

  private async handleType(action: AIAction): Promise<void> {
    if (!action.selector) throw new Error('Type action requires a selector');
    if (action.value === undefined) throw new Error('Type action requires a value');
    await this.page.waitForSelector(action.selector, { timeout: 10000 });
    await this.page.click(action.selector);
    await this.page.keyboard.type(action.value, { delay: 30 });
    logger.info(`Typed ${action.value.length} chars into "${action.selector}"`);
  }

  private async handleNavigate(action: AIAction): Promise<void> {
    if (!action.url) throw new Error('Navigate action requires a url');
    await this.page.goto(action.url, { waitUntil: 'networkidle' });
    logger.info(`Navigated to: ${action.url}`);
  }

  private async handleWait(action: AIAction): Promise<void> {
    const duration = action.duration || 3000;
    logger.info(`Waiting ${duration}ms...`);
    await this.page.waitForTimeout(duration);
  }

  private async handleScroll(action: AIAction): Promise<void> {
    if (action.selector) {
      await this.page.locator(action.selector).scrollIntoViewIfNeeded();
    } else {
      await this.page.evaluate(() => window.scrollBy(0, 500));
    }
    logger.info('Scrolled page');
  }

  /**
   * Send a message in MonkeyCode's chat interface.
   * Finds the chat input, types the message, and presses Enter.
   */
  private async handleSendMessage(action: AIAction): Promise<void> {
    if (!action.value) throw new Error('send_message action requires a value');

    // Try common chat input selectors
    const chatInputSelectors = [
      'textarea[placeholder*="message"]',
      'textarea[placeholder*="Message"]',
      'textarea[class*="chat"]',
      'textarea[class*="input"]',
      '[contenteditable="true"]',
      'textarea',
    ];

    let inputFound = false;
    for (const selector of chatInputSelectors) {
      try {
        const el = await this.page.$(selector);
        if (el) {
          await el.click();
          // Use fill for textarea, keyboard.type for contenteditable
          const tagName = await el.evaluate((e) => e.tagName.toLowerCase());
          if (tagName === 'textarea' || tagName === 'input') {
            await el.fill(action.value);
          } else {
            await this.page.keyboard.type(action.value, { delay: 20 });
          }
          // Press Enter or click send button to submit
          await this.page.keyboard.press('Enter');
          inputFound = true;
          logger.info(`Sent message (${action.value.length} chars) via "${selector}"`);
          break;
        }
      } catch {
        continue;
      }
    }

    if (!inputFound) {
      throw new Error('Could not find chat input element');
    }

    // Wait for response to start appearing
    await this.page.waitForTimeout(3000);
  }
}
