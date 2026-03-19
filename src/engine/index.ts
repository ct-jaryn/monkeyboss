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
      statusSummary: 'Initializing...',
      errors: [],
    };
  }

  /**
   * Start the main task loop. Runs until project is complete or max iterations reached.
   */
  async start(): Promise<void> {
    this.running = true;
    logger.info('=== MonkeyBoss Task Engine Starting ===');
    logger.info(`Project: ${this.config.task.projectName}`);
    logger.info(`Task: ${this.config.task.description}`);
    logger.info(`Max iterations: ${this.config.task.maxIterations}`);

    // Ensure screenshot directory exists
    if (!fs.existsSync(this.screenshotDir)) {
      fs.mkdirSync(this.screenshotDir, { recursive: true });
    }

    try {
      // Phase 1: Launch browser and authenticate
      await this.browserEngine.launch();
      const page = this.browserEngine.getPage();
      this.scraper.attachConsoleListener(page);
      await this.auth.login(page);

      // Phase 2: Main task loop
      await this.runLoop();
    } catch (error) {
      logger.error(`Task engine fatal error: ${error}`);
      this.state.status = 'failed';
      this.state.errors.push(String(error));
    } finally {
      await this.shutdown();
    }
  }

  private async runLoop(): Promise<void> {
    while (this.running && this.state.iteration < this.config.task.maxIterations) {
      this.state.iteration++;
      logger.info(`\n--- Iteration ${this.state.iteration} ---`);

      try {
        // Ensure browser is still alive
        await this.browserEngine.ensureAlive();
        const page = this.browserEngine.getPage();

        // Re-authenticate if needed
        await this.auth.ensureAuthenticated(page);

        // Scrape current page state
        const pageState = await this.scraper.scrape(page);

        // Ask AI what to do
        const aiResponse = await this.aiBridge.decide(
          pageState,
          this.buildTaskContext()
        );

        this.state.statusSummary = aiResponse.statusSummary;
        this.state.lastActivityAt = new Date();

        // Check if project is complete
        if (aiResponse.isProjectComplete) {
          logger.info('=== PROJECT COMPLETE ===');
          logger.info(`Summary: ${aiResponse.statusSummary}`);
          this.state.status = 'completed';
          this.running = false;
          break;
        }

        // Execute AI-decided actions
        const executor = new ActionExecutor(page);
        await executor.executeAll(aiResponse.actions);

        // Wait for page to settle after actions
        await page.waitForTimeout(this.config.task.loopInterval);

        // Periodic screenshot for debugging
        if (this.state.iteration % 10 === 0) {
          const screenshotPath = path.join(
            this.screenshotDir,
            `iteration-${this.state.iteration}.png`
          );
          await this.browserEngine.screenshot(screenshotPath);
        }

        // Log progress
        this.logProgress();
      } catch (error) {
        const errMsg = String(error);
        logger.error(`Iteration ${this.state.iteration} error: ${errMsg}`);
        this.state.errors.push(errMsg);

        // If too many consecutive errors, pause and retry
        if (this.state.errors.length > 10) {
          logger.warn('Too many errors, pausing for 30 seconds...');
          await new Promise((r) => setTimeout(r, 30000));
          this.state.errors = []; // Reset error counter
          this.aiBridge.resetHistory(); // Reset AI context
        }
      }
    }

    if (this.state.iteration >= this.config.task.maxIterations) {
      logger.warn(`Reached max iterations (${this.config.task.maxIterations})`);
      this.state.status = 'paused';
    }
  }

  private buildTaskContext(): string {
    return `Project: ${this.config.task.projectName}
Description: ${this.config.task.description}
Iteration: ${this.state.iteration}/${this.config.task.maxIterations}
Running since: ${this.state.startedAt.toISOString()}
Last activity: ${this.state.lastActivityAt.toISOString()}
Current status: ${this.state.statusSummary}`;
  }

  private logProgress(): void {
    const elapsed = Date.now() - this.state.startedAt.getTime();
    const hours = Math.floor(elapsed / 3600000);
    const minutes = Math.floor((elapsed % 3600000) / 60000);
    logger.info(
      `Progress: iteration ${this.state.iteration}, ` +
      `running ${hours}h ${minutes}m, ` +
      `status: ${this.state.statusSummary}`
    );
  }

  /**
   * Graceful shutdown.
   */
  async shutdown(): Promise<void> {
    this.running = false;
    logger.info('Shutting down task engine...');
    await this.browserEngine.close();
    logger.info(`Final state: ${this.state.status}, iterations: ${this.state.iteration}`);
    logger.info(`Errors encountered: ${this.state.errors.length}`);
  }

  /**
   * Stop the loop (can be called from signal handlers).
   */
  stop(): void {
    this.running = false;
    logger.info('Stop signal received');
  }

  getState(): TaskState {
    return { ...this.state };
  }
}
