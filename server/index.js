import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

const port = Number(process.env.PORT || 3000);
const publicDir = resolve("server/public");
const extensionDir = resolve("extension");

const state = {
  modelConfig: {
    provider: "openai",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    apiKey: "",
  },
  tasks: [
    {
      id: randomUUID(),
      target: "zhihu",
      action: "open_url",
      payload: { url: "https://www.zhihu.com/" },
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  extensions: new Map(),
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,X-Extension-Id",
  });
  res.end(JSON.stringify(data, null, 2));
}

function sendText(res, statusCode, text, contentType = "text/plain; charset=utf-8") {
  res.writeHead(statusCode, {
    "Content-Type": contentType,
    "Access-Control-Allow-Origin": "*",
  });
  res.end(text);
}

function sendExtensionArchive(res) {
  const archive = spawn("zip", ["-qr", "-", "."], {
    cwd: extensionDir,
  });

  let stderr = "";

  archive.on("error", () => {
    if (!res.headersSent) {
      sendText(res, 500, "Extension archive failed");
    }
  });

  archive.stderr.on("data", (chunk) => {
    stderr += chunk.toString("utf8");
  });

  res.writeHead(200, {
    "Content-Type": "application/zip",
    "Content-Disposition": 'attachment; filename="monkeyboss-extension.zip"',
    "Access-Control-Allow-Origin": "*",
  });

  archive.stdout.pipe(res);
  archive.on("close", (code) => {
    if (code !== 0) {
      console.error("Extension archive failed", stderr.trim());
    }

    if (!res.writableEnded) {
      res.end();
    }
  });
}

async function readJsonBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function getTaskSummary(task) {
  return {
    ...task,
    payload: task.payload || {},
  };
}

function getExtensionSummary(extension) {
  return {
    ...extension,
    syncMessage:
      extension.syncStatus === "synced"
        ? "已同步到服务端"
        : "等待同步中",
  };
}

function getNextPendingTask() {
  return state.tasks.find((task) => task.status === "pending");
}

function markTask(taskId, patch) {
  const task = state.tasks.find((item) => item.id === taskId);

  if (!task) {
    return null;
  }

  Object.assign(task, patch, { updatedAt: new Date().toISOString() });
  return task;
}

async function serveStatic(req, res) {
  const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
  const targetPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = join(publicDir, targetPath);
  const ext = extname(filePath);
  const contentTypeMap = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
  };

  try {
    const file = await readFile(filePath, "utf8");
    sendText(res, 200, file, contentTypeMap[ext] || "text/plain; charset=utf-8");
  } catch {
    sendText(res, 404, "Not Found");
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,X-Extension-Id",
    });
    res.end();
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/health") {
    sendJson(res, 200, {
      ok: true,
      service: "monkeyboss-server",
      extensions: state.extensions.size,
      tasks: state.tasks.length,
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/config/model") {
    sendJson(res, 200, state.modelConfig);
    return;
  }

  if (req.method === "PUT" && url.pathname === "/api/config/model") {
    const body = await readJsonBody(req);
    state.modelConfig = {
      ...state.modelConfig,
      provider: body.provider || state.modelConfig.provider,
      baseUrl: body.baseUrl || state.modelConfig.baseUrl,
      model: body.model || state.modelConfig.model,
      apiKey: body.apiKey || state.modelConfig.apiKey,
    };
    sendJson(res, 200, state.modelConfig);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/extensions/register") {
    const body = await readJsonBody(req);
    const extensionId = body.extensionId || randomUUID();
    const now = new Date().toISOString();
    state.extensions.set(extensionId, {
      extensionId,
      browser: body.browser || "chrome",
      version: body.version || "0.1.0",
      capabilities: body.capabilities || ["open_url", "like", "comment"],
      lastSeenAt: now,
      lastSyncAt: now,
      syncStatus: "synced",
    });
    sendJson(res, 200, { extensionId });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/extensions") {
    sendJson(res, 200, Array.from(state.extensions.values()).map(getExtensionSummary));
    return;
  }

  if (req.method === "GET" && url.pathname === "/downloads/extension") {
    sendExtensionArchive(res);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/tasks") {
    sendJson(res, 200, state.tasks.map(getTaskSummary));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/tasks") {
    const body = await readJsonBody(req);
    const task = {
      id: randomUUID(),
      target: body.target || "generic",
      action: body.action || "open_url",
      payload: body.payload || {},
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    state.tasks.unshift(task);
    sendJson(res, 201, task);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/extensions/next-task") {
    const extensionId = req.headers["x-extension-id"];

    if (!extensionId || !state.extensions.has(extensionId)) {
      sendJson(res, 401, { error: "extension_not_registered" });
      return;
    }

    const nextTask = getNextPendingTask();

    if (!nextTask) {
      const now = new Date().toISOString();
      Object.assign(state.extensions.get(extensionId), {
        lastSeenAt: now,
        lastSyncAt: now,
        syncStatus: "synced",
      });
      sendJson(res, 200, { task: null });
      return;
    }

    markTask(nextTask.id, {
      status: "assigned",
      assignedTo: extensionId,
    });

    const now = new Date().toISOString();
    Object.assign(state.extensions.get(extensionId), {
      lastSeenAt: now,
      lastSyncAt: now,
      syncStatus: "synced",
    });
    sendJson(res, 200, { task: nextTask });
    return;
  }

  if (req.method === "POST" && url.pathname.startsWith("/api/tasks/") && url.pathname.endsWith("/result")) {
    const taskId = url.pathname.split("/")[3];
    const body = await readJsonBody(req);
    const task = markTask(taskId, {
      status: body.status || "completed",
      result: body.result || {},
      error: body.error || null,
    });

    if (!task) {
      sendJson(res, 404, { error: "task_not_found" });
      return;
    }

    sendJson(res, 200, task);
    return;
  }

  await serveStatic(req, res);
});

server.listen(port, () => {
  console.log(`MonkeyBoss server running at http://localhost:${port}`);
});
