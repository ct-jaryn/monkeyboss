import express from 'express';
import cors from 'cors';
import path from 'path';
import { Config, loadConfig } from '../config';
import { TaskEngine } from '../engine';
import { logger } from '../utils/logger';

interface RuntimeState {
  config: Partial<Config>;
  engine: TaskEngine | null;
  logs: string[];
}

const state: RuntimeState = {
  config: loadConfig(),
  engine: null,
  logs: [],
};

// Intercept logger to capture logs for the web panel
const originalLog = logger.info.bind(logger);
const originalWarn = logger.warn.bind(logger);
const originalError = logger.error.bind(logger);

function captureLog(level: string, msg: string) {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  state.logs.push(`[${ts}] ${level}: ${msg}`);
  if (state.logs.length > 500) state.logs = state.logs.slice(-500);
}

logger.info = ((msg: string) => { captureLog('INFO', msg); return originalLog(msg); }) as any;
logger.warn = ((msg: string) => { captureLog('WARN', msg); return originalWarn(msg); }) as any;
logger.error = ((msg: string) => { captureLog('ERROR', msg); return originalError(msg); }) as any;

let logCursor = 0;

export function createWebServer(port = 3000): express.Express {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Serve static frontend
  app.use(express.static(path.join(__dirname, 'public')));

  // GET /api/status
  app.get('/api/status', (_req, res) => {
    if (state.engine) {
      const s = state.engine.getState();
      res.json({
        status: s.status,
        iteration: s.iteration,
        maxIterations: (state.config.task as any)?.maxIterations || 1000,
        startedAt: s.startedAt,
        lastActivityAt: s.lastActivityAt,
        statusSummary: s.statusSummary,
        errorCount: s.errors.length,
        lastError: s.errors.length > 0 ? s.errors[s.errors.length - 1] : null,
        activeModule: 'engine',
      });
    } else {
      res.json({
        status: 'idle',
        iteration: 0,
        maxIterations: (state.config.task as any)?.maxIterations || 1000,
        startedAt: null,
        lastActivityAt: null,
        statusSummary: '尚未启动',
        errorCount: 0,
        lastError: null,
        activeModule: null,
      });
    }
  });

  // POST /api/config
  app.post('/api/config', (req, res) => {
    const body = req.body;
    const cfg = state.config as any;
    if (body.monkeycode) {
      cfg.monkeycode = { ...cfg.monkeycode, ...body.monkeycode };
    }
    if (body.ai) {
      cfg.ai = { ...cfg.ai, ...body.ai };
    }
    if (body.task) {
      cfg.task = { ...cfg.task, ...body.task };
    }
    logger.info('已通过控制面板更新配置');
    res.json({ ok: true });
  });

  // POST /api/task/start
  app.post('/api/task/start', (_req, res) => {
    if (state.engine) {
      const s = state.engine.getState();
      if (s.status === 'running') {
        return res.json({ ok: false, error: '任务已在运行中' });
      }
    }

    const config = state.config as Config;
    // Validate minimum config
    if (!config.monkeycode?.username || !config.ai?.apiKey || !config.task?.projectName) {
      return res.json({ ok: false, error: '缺少必要配置（用户名、API密钥、项目名称）' });
    }

    state.engine = new TaskEngine(config);
    // Run in background
    state.engine.start().catch((err) => {
      logger.error(`引擎崩溃: ${err}`);
    });

    logger.info('已通过控制面板启动任务引擎');
    res.json({ ok: true });
  });

  // POST /api/task/stop
  app.post('/api/task/stop', (_req, res) => {
    if (state.engine) {
      state.engine.stop();
      logger.info('已通过控制面板停止任务引擎');
      res.json({ ok: true });
    } else {
      res.json({ ok: false, error: '当前没有运行中的任务' });
    }
  });

  // GET /api/logs (incremental)
  app.get('/api/logs', (_req, res) => {
    const newLogs = state.logs.slice(logCursor);
    logCursor = state.logs.length;
    res.json({ logs: newLogs });
  });

  // Fallback to index.html for SPA
  app.use((_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  app.listen(port, '0.0.0.0', () => {
    logger.info(`MonkeyBoss 控制面板已启动: http://0.0.0.0:${port}`);
  });

  return app;
}
