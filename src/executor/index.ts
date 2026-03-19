import { Page } from 'playwright';
import { AIAction } from '../ai';
import { logger } from '../utils/logger';

export class ActionExecutor {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async executeAll(actions: AIAction[]): Promise<void> {
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      logger.info(`执行操作 [${i + 1}/${actions.length}]: ${action.type} - ${action.reason}`);
      try {
        await this.execute(action);
        await this.page.waitForTimeout(500);
      } catch (error) {
        logger.error(`操作失败 [${action.type}]: ${error}`);
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
        logger.info('AI 发出项目完成信号');
        break;
      default:
        logger.warn(`未知操作类型: ${action.type}`);
    }
  }

  private async handleClick(action: AIAction): Promise<void> {
    if (!action.selector) throw new Error('点击操作需要指定选择器');
    await this.page.waitForSelector(action.selector, { timeout: 10000 });
    await this.page.click(action.selector);
    logger.info(`已点击: ${action.selector}`);
  }

  private async handleFill(action: AIAction): Promise<void> {
    if (!action.selector) throw new Error('填充操作需要指定选择器');
    if (action.value === undefined) throw new Error('填充操作需要指定值');
    await this.page.waitForSelector(action.selector, { timeout: 10000 });
    await this.page.fill(action.selector, action.value);
    logger.info(`已填充 "${action.selector}"，共 ${action.value.length} 个字符`);
  }

  private async handleType(action: AIAction): Promise<void> {
    if (!action.selector) throw new Error('输入操作需要指定选择器');
    if (action.value === undefined) throw new Error('输入操作需要指定值');
    await this.page.waitForSelector(action.selector, { timeout: 10000 });
    await this.page.click(action.selector);
    await this.page.keyboard.type(action.value, { delay: 30 });
    logger.info(`已输入 ${action.value.length} 个字符到 "${action.selector}"`);
  }

  private async handleNavigate(action: AIAction): Promise<void> {
    if (!action.url) throw new Error('导航操作需要指定 URL');
    await this.page.goto(action.url, { waitUntil: 'networkidle' });
    logger.info(`已导航至: ${action.url}`);
  }

  private async handleWait(action: AIAction): Promise<void> {
    const duration = action.duration || 3000;
    logger.info(`等待 ${duration} 毫秒...`);
    await this.page.waitForTimeout(duration);
  }

  private async handleScroll(action: AIAction): Promise<void> {
    if (action.selector) {
      await this.page.locator(action.selector).scrollIntoViewIfNeeded();
    } else {
      await this.page.evaluate(() => window.scrollBy(0, 500));
    }
    logger.info('已滚动页面');
  }

  private async handleSendMessage(action: AIAction): Promise<void> {
    if (!action.value) throw new Error('发送消息操作需要指定内容');

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
          const tagName = await el.evaluate((e) => e.tagName.toLowerCase());
          if (tagName === 'textarea' || tagName === 'input') {
            await el.fill(action.value);
          } else {
            await this.page.keyboard.type(action.value, { delay: 20 });
          }
          await this.page.keyboard.press('Enter');
          inputFound = true;
          logger.info(`已发送消息（${action.value.length} 个字符），通过 "${selector}"`);
          break;
        }
      } catch {
        continue;
      }
    }

    if (!inputFound) {
      throw new Error('无法找到聊天输入框');
    }

    await this.page.waitForTimeout(3000);
  }
}
