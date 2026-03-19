import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export interface Config {
  monkeycode: {
    url: string;
    username: string;
    password: string;
  };
  ai: {
    provider: 'openai' | 'anthropic' | 'custom';
    apiKey: string;
    model: string;
    baseUrl?: string;
  };
  browser: {
    headless: boolean;
    timeout: number;
  };
  task: {
    projectName: string;
    description: string;
    maxIterations: number;
    loopInterval: number;
  };
  log: {
    level: string;
    file: string;
  };
}

export function loadConfig(): Config {
  return {
    monkeycode: {
      url: process.env.MONKEYCODE_URL || 'https://monkeycode.ai',
      username: process.env.MONKEYCODE_USERNAME || '',
      password: process.env.MONKEYCODE_PASSWORD || '',
    },
    ai: {
      provider: (process.env.AI_PROVIDER as Config['ai']['provider']) || 'openai',
      apiKey: process.env.AI_API_KEY || '',
      model: process.env.AI_MODEL || 'gpt-4o',
      baseUrl: process.env.AI_BASE_URL || undefined,
    },
    browser: {
      headless: process.env.BROWSER_HEADLESS !== 'false',
      timeout: parseInt(process.env.BROWSER_TIMEOUT || '30000', 10),
    },
    task: {
      projectName: process.env.TASK_PROJECT_NAME || '',
      description: process.env.TASK_DESCRIPTION || '',
      maxIterations: parseInt(process.env.TASK_MAX_ITERATIONS || '1000', 10),
      loopInterval: parseInt(process.env.TASK_LOOP_INTERVAL || '5000', 10),
    },
    log: {
      level: process.env.LOG_LEVEL || 'info',
      file: process.env.LOG_FILE || 'monkeyboss.log',
    },
  };
}

export function validateConfig(config: Config): string[] {
  const errors: string[] = [];
  if (!config.monkeycode.username) errors.push('MONKEYCODE_USERNAME 未配置（MonkeyCode 用户名）');
  if (!config.monkeycode.password) errors.push('MONKEYCODE_PASSWORD 未配置（MonkeyCode 密码）');
  if (!config.ai.apiKey) errors.push('AI_API_KEY 未配置（AI 服务密钥）');
  if (!config.task.projectName) errors.push('TASK_PROJECT_NAME 未配置（项目名称）');
  if (!config.task.description) errors.push('TASK_DESCRIPTION 未配置（任务描述）');
  return errors;
}
