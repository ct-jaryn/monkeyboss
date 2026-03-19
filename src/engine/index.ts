import { Config } from '../config';
import { BrowserEngine } from '../browser';
import { MonkeyCodeAuth } from '../auth';
import { PageScraper } from '../scraper';
import { AIBridge } from '../ai';
import { ActionExecutor } from '../executor';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';

export interface TaskState {
  iteration: number;
  startedAt: Date;
  lastActivityAt: Date;
  status: 'running' | 'completed' | 'failed' | 'paused';
  statusSummary: string;
  errors: string[];
}

export class TaskEngine {
  private config: Config;
  private browserEngine: BrowserEngine;
  private auth: MonkeyCodeAuth;
  private scraper: PageScraper;
  private aiBridge: AIBridge;
  private state: TaskState;
  private running = false;
  private screenshotDir: string;

  constructor(config: Config) {
    this.config = config;
    this.browserEngine = new BrowserEngine(config);
    this.auth = new MonkeyCodeAuth(config);
    this.scraper = new PageScraper();
    this.aiBridge = new AIBridge(config);
    this.screenshotDir = path.join(process.cwd(), 'screenshots');
    this.state = {
      iteration: 0,
      startedAt: new Date(),
      lastActivityAt: new Date(),
      status: 'running',
      statusSummary: '初始化中...',
      errors: [],
    };
  }

  async start(): Promise<void> {
    this.running = true;
    logger.info('=== MonkeyBoss 任务引擎启动 ===');
    logger.info(`项目: ${this.config.task.projectName}`);
    logger.info(`任务: ${this.config.task.description}`);
    logger.info(`最大迭代次数: ${this.config.task.maxIterations}`);

    if (!fs.existsSync(this.screenshotDir)) {
      fs.mkdirSync(this.screenshotDir, { recursive: true });
    }

    try {
      await this.browserEngine.launch();
      const page = this.browserEngine.getPage();
      this.scraper.attachConsoleListener(page);
      await this.auth.login(page);

      await this.runLoop();
    } catch (error) {
      logger.error(`任务引擎致命错误: ${error}`);
      this.state.status = 'failed';
      this.state.errors.push(String(error));
    } finally {
      await this.shutdown();
    }
  }

  private async runLoop(): Promise<void> {
    while (this.running && this.state.iteration < this.config.task.maxIterations) {
      this.state.iteration++;
      logger.info(`\n--- 第 ${this.state.iteration} 次迭代 ---`);

      try {
        await this.browserEngine.ensureAlive();
        const page = this.browserEngine.getPage();

        await this.auth.ensureAuthenticated(page);

        const pageState = await this.scraper.scrape(page);

        const aiResponse = await this.aiBridge.decide(
          pageState,
          this.buildTaskContext()
        );

        this.state.statusSummary = aiResponse.statusSummary;
        this.state.lastActivityAt = new Date();

        if (aiResponse.isProjectComplete) {
          logger.info('=== 项目已完成 ===');
          logger.info(`摘要: ${aiResponse.statusSummary}`);
          this.state.status = 'completed';
          this.running = false;
          break;
        }

        const executor = new ActionExecutor(page);
        await executor.executeAll(aiResponse.actions);

        await page.waitForTimeout(this.config.task.loopInterval);

        if (this.state.iteration % 10 === 0) {
          const screenshotPath = path.join(
            this.screenshotDir,
            `iteration-${this.state.iteration}.png`
          );
          await this.browserEngine.screenshot(screenshotPath);
        }

        this.logProgress();
      } catch (error) {
        const errMsg = String(error);
        logger.error(`第 ${this.state.iteration} 次迭代出错: ${errMsg}`);
        this.state.errors.push(errMsg);

        if (this.state.errors.length > 10) {
          logger.warn('错误过多，暂停 30 秒后重试...');
          await new Promise((r) => setTimeout(r, 30000));
          this.state.errors = [];
          this.aiBridge.resetHistory();
        }
      }
    }

    if (this.state.iteration >= this.config.task.maxIterations) {
      logger.warn(`已达到最大迭代次数（${this.config.task.maxIterations}）`);
      this.state.status = 'paused';
    }
  }

  private buildTaskContext(): string {
    return `项目: ${this.config.task.projectName}
描述: ${this.config.task.description}
迭代: ${this.state.iteration}/${this.config.task.maxIterations}
启动时间: ${this.state.startedAt.toISOString()}
最后活动: ${this.state.lastActivityAt.toISOString()}
当前状态: ${this.state.statusSummary}`;
  }

  private logProgress(): void {
    const elapsed = Date.now() - this.state.startedAt.getTime();
    const hours = Math.floor(elapsed / 3600000);
    const minutes = Math.floor((elapsed % 3600000) / 60000);
    logger.info(
      `进度: 第 ${this.state.iteration} 次迭代, ` +
      `已运行 ${hours}小时${minutes}分钟, ` +
      `状态: ${this.state.statusSummary}`
    );
  }

  async shutdown(): Promise<void> {
    this.running = false;
    logger.info('正在关闭任务引擎...');
    await this.browserEngine.close();
    logger.info(`最终状态: ${this.state.status}, 迭代次数: ${this.state.iteration}`);
    logger.info(`累计错误: ${this.state.errors.length} 个`);
  }

  stop(): void {
    this.running = false;
    logger.info('收到停止信号');
  }

  getState(): TaskState {
    return { ...this.state };
  }
}
