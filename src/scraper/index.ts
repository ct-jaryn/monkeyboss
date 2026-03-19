import { Page } from 'playwright';
import { logger } from '../utils/logger';

export interface PageState {
  url: string;
  title: string;
  textContent: string;
  interactiveElements: InteractiveElement[];
  consoleLogs: string[];
  chatContent: string;
  screenshotBase64?: string;
}

export interface InteractiveElement {
  index: number;
  tag: string;
  type?: string;
  text: string;
  placeholder?: string;
  selector: string;
  role?: string;
}

export class PageScraper {
  private consoleLogs: string[] = [];

  attachConsoleListener(page: Page): void {
    page.on('console', (msg) => {
      this.consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
      if (this.consoleLogs.length > 50) {
        this.consoleLogs = this.consoleLogs.slice(-50);
      }
    });
  }

  async scrape(page: Page, includeScreenshot = false): Promise<PageState> {
    logger.info('正在采集页面状态...');

    const [url, title, textContent, interactiveElements, chatContent] = await Promise.all([
      page.url(),
      page.title(),
      this.extractTextContent(page),
      this.extractInteractiveElements(page),
      this.extractChatContent(page),
    ]);

    const state: PageState = {
      url,
      title,
      textContent,
      interactiveElements,
      consoleLogs: [...this.consoleLogs],
      chatContent,
    };

    if (includeScreenshot) {
      const buffer = await page.screenshot({ type: 'png', fullPage: false });
      state.screenshotBase64 = buffer.toString('base64');
    }

    this.consoleLogs = [];

    logger.info(
      `采集完成: ${interactiveElements.length} 个交互元素, ` +
      `${textContent.length} 字符文本`
    );
    return state;
  }

  private async extractTextContent(page: Page): Promise<string> {
    return page.evaluate(() => {
      const body = document.body;
      if (!body) return '';
      const walker = document.createTreeWalker(
        body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode(node) {
            const parent = node.parentElement;
            if (!parent) return NodeFilter.FILTER_REJECT;
            const tag = parent.tagName.toLowerCase();
            if (['script', 'style', 'noscript'].includes(tag)) {
              return NodeFilter.FILTER_REJECT;
            }
            const style = window.getComputedStyle(parent);
            if (style.display === 'none' || style.visibility === 'hidden') {
              return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
          },
        }
      );
      const texts: string[] = [];
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const text = (node.textContent || '').trim();
        if (text) texts.push(text);
      }
      return texts.join('\n').slice(0, 8000);
    });
  }

  private async extractInteractiveElements(page: Page): Promise<InteractiveElement[]> {
    return page.evaluate(() => {
      const selectors = 'a, button, input, textarea, select, [role="button"], [contenteditable="true"]';
      const elements = Array.from(document.querySelectorAll(selectors));
      return elements
        .filter((el) => {
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden';
        })
        .slice(0, 100)
        .map((el, index) => {
          const tag = el.tagName.toLowerCase();
          const buildSelector = (): string => {
            if (el.id) return `#${el.id}`;
            const text = (el.textContent || '').trim().slice(0, 30);
            if (tag === 'button' && text) return `button:has-text("${text}")`;
            if (tag === 'a' && text) return `a:has-text("${text}")`;
            if (tag === 'input') {
              const name = el.getAttribute('name');
              if (name) return `input[name="${name}"]`;
              const placeholder = el.getAttribute('placeholder');
              if (placeholder) return `input[placeholder="${placeholder}"]`;
            }
            if (tag === 'textarea') {
              const name = el.getAttribute('name');
              if (name) return `textarea[name="${name}"]`;
            }
            return `${tag}:nth-of-type(${index + 1})`;
          };
          return {
            index,
            tag,
            type: el.getAttribute('type') || undefined,
            text: (el.textContent || '').trim().slice(0, 80),
            placeholder: el.getAttribute('placeholder') || undefined,
            selector: buildSelector(),
            role: el.getAttribute('role') || undefined,
          };
        });
    });
  }

  private async extractChatContent(page: Page): Promise<string> {
    return page.evaluate(() => {
      const chatSelectors = [
        '[class*="chat"]',
        '[class*="message"]',
        '[class*="conversation"]',
        '[class*="dialog"]',
        '[role="log"]',
        '.messages-container',
      ];
      for (const selector of chatSelectors) {
        const container = document.querySelector(selector);
        if (container && container.textContent && container.textContent.trim().length > 20) {
          return container.textContent.trim().slice(0, 6000);
        }
      }
      return '';
    });
  }
}
