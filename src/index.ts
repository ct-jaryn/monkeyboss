#!/usr/bin/env node

import { Command } from 'commander';
import { loadConfig, validateConfig } from './config';
import { TaskEngine } from './engine';
import { createWebServer } from './web/server';
import { logger } from './utils/logger';

const program = new Command();

program
  .name('monkeyboss')
  .description('MonkeyCode 自动化管理工具 - AI 驱动的 7x24 持续开发代理')
  .version('1.0.0');

program
  .command('run')
  .description('启动自动化任务循环')
  .option('-p, --project <name>', '项目名称（覆盖 TASK_PROJECT_NAME）')
  .option('-d, --desc <description>', '任务描述（覆盖 TASK_DESCRIPTION）')
  .option('--no-headless', '以可视化模式运行浏览器')
  .option('--max-iterations <n>', '最大迭代次数', parseInt)
  .action(async (opts) => {
    const config = loadConfig();

    if (opts.project) config.task.projectName = opts.project;
    if (opts.desc) config.task.description = opts.desc;
    if (opts.headless === false) config.browser.headless = false;
    if (opts.maxIterations) config.task.maxIterations = opts.maxIterations;

    const errors = validateConfig(config);
    if (errors.length > 0) {
      logger.error('配置错误:');
      errors.forEach((e) => logger.error(`  - ${e}`));
      logger.error('请检查 .env 文件或传入必要的参数');
      process.exit(1);
    }

    const engine = new TaskEngine(config);

    const shutdown = () => {
      logger.info('收到关闭信号...');
      engine.stop();
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    await engine.start();

    const state = engine.getState();
    process.exit(state.status === 'completed' ? 0 : 1);
  });

program
  .command('validate')
  .description('验证配置是否正确')
  .action(() => {
    const config = loadConfig();
    const errors = validateConfig(config);
    if (errors.length === 0) {
      logger.info('配置验证通过');
    } else {
      logger.error('配置错误:');
      errors.forEach((e) => logger.error(`  - ${e}`));
      process.exit(1);
    }
  });

program
  .command('web')
  .description('启动 Web 控制面板')
  .option('--port <port>', '服务端口', parseInt)
  .action((opts) => {
    const port = opts.port || 3000;
    createWebServer(port);
    logger.info(`Web 控制面板已启动，端口: ${port}`);
  });

program.parse();
