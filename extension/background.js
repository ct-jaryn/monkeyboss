const DEFAULT_SERVER_URL = "http://localhost:3000";
const DEFAULT_EXTENSION_ID = `ext_${crypto.randomUUID()}`;
let syncTimer = null;

function normalizeServerUrl(serverUrl) {
  const value = (serverUrl || "").trim();
  return value.replace(/\/+$/, "");
}

async function getSettings() {
  const stored = await chrome.storage.local.get(["serverUrl", "extensionId"]);
  return {
    serverUrl: normalizeServerUrl(stored.serverUrl) || DEFAULT_SERVER_URL,
    extensionId: stored.extensionId || DEFAULT_EXTENSION_ID,
  };
}

async function saveSettings(settings) {
  await chrome.storage.local.set({
    serverUrl: normalizeServerUrl(settings.serverUrl),
    extensionId: settings.extensionId,
  });
}

async function registerExtension() {
  const settings = await getSettings();
  const response = await fetch(`${settings.serverUrl}/api/extensions/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      extensionId: settings.extensionId,
      browser: "chrome",
      version: chrome.runtime.getManifest().version,
      capabilities: ["open_url", "like", "comment"],
    }),
  });

  if (!response.ok) {
    throw new Error(`Register failed: ${response.status} ${await response.text()}`);
  }

  await saveSettings(settings);
  return settings;
}

async function reportResult(serverUrl, taskId, payload) {
  const response = await fetch(`${serverUrl}/api/tasks/${taskId}/result`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Report failed: ${response.status} ${await response.text()}`);
  }
}

async function executeTask(task) {
  const { serverUrl } = await getSettings();

  try {
    if (task.action === "open_url" && task.payload?.url) {
      await chrome.tabs.create({ url: task.payload.url, active: false });
      await reportResult(serverUrl, task.id, {
        status: "completed",
        result: { message: "Opened target url", data: task.payload },
      });
      return;
    }

    await reportResult(serverUrl, task.id, {
      status: "completed",
      result: {
        message: `Stub executed for action ${task.action}`,
        data: task.payload || {},
      },
    });
  } catch (error) {
    await reportResult(serverUrl, task.id, {
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function syncOnce() {
  const settings = await registerExtension();
  const response = await fetch(`${settings.serverUrl}/api/extensions/next-task`, {
    headers: {
      "X-Extension-Id": settings.extensionId,
    },
  });

  if (!response.ok) {
    throw new Error(`Task sync failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();

  if (data.task) {
    await executeTask(data.task);
  }
}

function startSyncLoop() {
  if (syncTimer) {
    clearInterval(syncTimer);
  }

  syncOnce().catch((error) => console.warn("MonkeyBoss sync error", error));
  syncTimer = setInterval(() => {
    syncOnce().catch((error) => console.warn("MonkeyBoss sync error", error));
  }, 5000);
}

chrome.runtime.onInstalled.addListener(() => {
  startSyncLoop();
});

chrome.runtime.onStartup.addListener(() => {
  startSyncLoop();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "get-settings") {
    getSettings().then(sendResponse);
    return true;
  }

  if (message?.type === "save-settings") {
    saveSettings({
      serverUrl: message.serverUrl,
      extensionId: message.extensionId,
    }).then(() => {
      startSyncLoop();
      sendResponse({ ok: true });
    }).catch((error) => {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
    });
    return true;
  }

  if (message?.type === "sync-now") {
    syncOnce()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }

  return false;
});

startSyncLoop();
