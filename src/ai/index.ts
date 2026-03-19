import OpenAI from 'openai';
import { Config } from '../config';
import { PageState } from '../scraper';
import { logger } from '../utils/logger';

/**
 * AI returns a list of actions to perform on the page.
 */
export interface AIAction {
  type: 'click' | 'fill' | 'type' | 'navigate' | 'wait' | 'scroll' | 'send_message' | 'done';
  selector?: string;
  value?: string;
  url?: string;
  duration?: number;
  reason: string;
}

export interface AIResponse {
  thinking: string;
  actions: AIAction[];
  isProjectComplete: boolean;
  statusSummary: string;
}

const SYSTEM_PROMPT = `You are MonkeyBoss, an AI agent that controls a browser to operate the MonkeyCode development platform. Your goal is to drive a software project to completion by interacting with MonkeyCode's AI coding assistant.

You receive the current page state (URL, text content, interactive elements, chat history) and must decide what actions to take next.

Your workflow:
1. Analyze the current page state
2. Determine what needs to happen next to progress the project
3. Return a list of browser actions to execute

Key behaviors:
- If on the MonkeyCode workspace, read the chat/conversation to understand current progress
- Send messages to MonkeyCode's AI to request code generation, bug fixes, etc.
- Navigate between files, settings, and project views as needed
- Monitor build/test results and respond to errors
- Keep the project moving forward until all features are implemented

Return your response as JSON with this structure:
{
  "thinking": "Your analysis of the current state and what to do next",
  "actions": [
    {
      "type": "click|fill|type|navigate|wait|scroll|send_message|done",
      "selector": "CSS selector for the target element (if applicable)",
      "value": "text to type or message to send (if applicable)",
      "url": "URL to navigate to (for navigate action)",
      "duration": 5000,
      "reason": "Why this action is needed"
    }
  ],
  "isProjectComplete": false,
  "statusSummary": "Brief summary of current project status"
}

Action types:
- click: Click an element
- fill: Clear and fill an input field
- type: Type text character by character (for contenteditable areas)
- navigate: Go to a URL
- wait: Wait for a duration (ms)
- scroll: Scroll the page
- send_message: Type a message in MonkeyCode's chat input and send it
- done: Project is complete, stop the loop`;

export class AIBridge {
  private client: OpenAI;
  private config: Config;
  private conversationHistory: OpenAI.Chat.ChatCompletionMessageParam[] = [];

  constructor(config: Config) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.ai.apiKey,
      baseURL: config.ai.baseUrl || undefined,
    });
  }

  /**
   * Send page state to AI and get back a list of actions.
   */
  async decide(pageState: PageState, taskDescription: string): Promise<AIResponse> {
    logger.info('正在将页面状态发送给 AI 进行决策...');

    const userMessage = this.buildUserMessage(pageState, taskDescription);

    // Keep conversation history manageable (last 20 exchanges)
    if (this.conversationHistory.length > 40) {
      this.conversationHistory = this.conversationHistory.slice(-20);
    }

    this.conversationHistory.push({ role: 'user', content: userMessage });

    try {
      const response = await this.client.chat.completions.create({
        model: this.config.ai.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...this.conversationHistory,
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('AI 返回为空');

      this.conversationHistory.push({ role: 'assistant', content });

      const parsed = JSON.parse(content) as AIResponse;
      logger.info(`AI 决策: ${parsed.statusSummary}`);
      logger.info(`AI 思考: ${parsed.thinking.slice(0, 200)}...`);
      logger.info(`待执行操作: ${parsed.actions.length} 个`);

      return parsed;
    } catch (error) {
      logger.error(`AI 决策失败: ${error}`);
      return {
        thinking: 'AI 调用失败，等待后重试',
        actions: [{ type: 'wait', duration: 10000, reason: 'AI 出错，冷却等待' }],
        isProjectComplete: false,
        statusSummary: 'AI 出错 - 等待重试',
      };
    }
  }

  private buildUserMessage(pageState: PageState, taskDescription: string): string {
    const elements = pageState.interactiveElements
      .map((el) => `  [${el.index}] <${el.tag}> "${el.text}" selector="${el.selector}"`)
      .join('\n');

    return `## Current Task
${taskDescription}

## Page State
URL: ${pageState.url}
Title: ${pageState.title}

### Page Text Content
${pageState.textContent.slice(0, 4000)}

### Chat/Conversation Content
${pageState.chatContent || '(no chat content detected)'}

### Interactive Elements
${elements || '(no interactive elements found)'}

### Recent Console Logs
${pageState.consoleLogs.slice(-10).join('\n') || '(none)'}

## Instructions
Analyze the page state and decide what actions to take next to progress the project. Return JSON.`;
  }

  /**
   * Reset conversation history (e.g., after major navigation).
   */
  resetHistory(): void {
    this.conversationHistory = [];
    logger.info('AI 对话历史已重置');
  }
}
