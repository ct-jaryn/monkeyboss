import { Page } from 'playwright';
import { logger } from '../utils/logger';

/**
 * Structured page state sent to AI for decision making.
 */
export interface PageState {
  url: string;
  title: string;
  /** Simplified DOM text content */
  textContent: string;
  /** Interactive elements on the page */
  interactiveElements: InteractiveElement[];
  /** Console messages since last scrape */
  consoleLogs: string[];
  /** Current visible text in the chat/editor area */
  chatContent: string;
  /** Screenshot as base64 (optional, for vision models) */
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

  /**
   * Attach console listener to capture browser logs.
   */
  attachConsoleListener(page: Page): void {
    page.on('console', (msg) => {
      this.consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
      // Keep only last 50 logs
      if (this.consoleLogs.length > 50) {
        this.consoleLogs = this.consoleLogs.slice(-50);
      }
    });
  }

  /**
   * Extract full page state for AI consumption.
   */
  async scrape(page: Page, includeScreenshot = false): Promise<PageState> {
    logger.info('Scraping page state...');

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

    // Clear console logs after scrape
    this.consoleLogs = [];

    logger.info(
      `Scraped: ${interactiveElements.length} interactive elements, ` +
      `${textContent.length} chars text`
    );
    return state;
  }

  private async extractTextContent(page: Page): Promise<string> {
    return page.evaluate(() => {
      const body = document.body;
      if (!body) return '';
      // Get visible text, skip script/style
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
      // Limit to 8000 chars to fit in AI context
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
        .slice(0, 100) // Limit to 100 elements
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

  /**
   * Extract content from MonkeyCode's chat/conversation area.
   * This captures the AI assistant's messages and user messages.
   */
  private async extractChatContent(page: Page): Promise<string> {
    return page.evaluate(() => {
      // Try common chat container selectors
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
