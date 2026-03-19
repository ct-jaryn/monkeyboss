#!/usr/bin/env node

import { Command } from 'commander';
import { loadConfig, validateConfig } from './config';
import { TaskEngine } from './engine';
import { logger } from './utils/logger';

const program = new Command();

program
  .name('monkeyboss')
  .description('MonkeyCode automation agent - AI-driven 7x24 continuous development')
  .version('1.0.0');

program
  .command('run')
  .description('Start the automation loop')
  .option('-p, --project <name>', 'Project name (overrides TASK_PROJECT_NAME)')
  .option('-d, --desc <description>', 'Task description (overrides TASK_DESCRIPTION)')
  .option('--no-headless', 'Run browser in visible mode')
  .option('--max-iterations <n>', 'Maximum iterations', parseInt)
  .action(async (opts) => {
    const config = loadConfig();

    // CLI overrides
    if (opts.project) config.task.projectName = opts.project;
    if (opts.desc) config.task.description = opts.desc;
    if (opts.headless === false) config.browser.headless = false;
    if (opts.maxIterations) config.task.maxIterations = opts.maxIterations;

    // Validate
    const errors = validateConfig(config);
    if (errors.length > 0) {
      logger.error('Configuration errors:');
      errors.forEach((e) => logger.error(`  - ${e}`));
      logger.error('Please check your .env file or pass required options');
      process.exit(1);
    }

    const engine = new TaskEngine(config);

    // Graceful shutdown on signals
    const shutdown = () => {
      logger.info('Received shutdown signal...');
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
  .description('Validate configuration')
  .action(() => {
    const config = loadConfig();
    const errors = validateConfig(config);
    if (errors.length === 0) {
      logger.info('Configuration is valid');
    } else {
      logger.error('Configuration errors:');
      errors.forEach((e) => logger.error(`  - ${e}`));
      process.exit(1);
    }
  });

program.parse();
