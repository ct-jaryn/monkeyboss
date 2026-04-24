const serverUrlInput = document.getElementById("serverUrl");
const extensionIdInput = document.getElementById("extensionId");
const statusNode = document.getElementById("status");
const hintNode = document.getElementById("hint");

function normalizeServerUrl(serverUrl) {
  return (serverUrl || "").trim().replace(/\/+$/, "");
}

function setStatus(text) {
  statusNode.textContent = text;
}

async function detectServerOrigin() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const activeTab = tabs[0];

  if (!activeTab?.url) {
    return "";
  }

  try {
    const url = new URL(activeTab.url);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.origin;
    }
  } catch {
    return "";
  }

  return "";
}

async function loadSettings() {
  const settings = await chrome.runtime.sendMessage({ type: "get-settings" });
  const suggestedOrigin = await detectServerOrigin();
  const normalizedStored = normalizeServerUrl(settings.serverUrl);

  serverUrlInput.value =
    normalizedStored === "http://localhost:3000" && suggestedOrigin ? suggestedOrigin : normalizedStored;
  extensionIdInput.value = settings.extensionId;
  hintNode.textContent =
    "如果服务端不是运行在你本机，请把 Server URL 设置为控制台页面地址，例如当前打开页面的地址。";
}

loadSettings();

document.getElementById("saveButton").addEventListener("click", () => {
  chrome.runtime.sendMessage(
    {
      type: "save-settings",
      serverUrl: normalizeServerUrl(serverUrlInput.value),
      extensionId: extensionIdInput.value.trim(),
    },
    (response) => {
      setStatus(response?.ok ? "配置已保存" : `保存失败: ${response?.error || "unknown"}`);
    },
  );
});

document.getElementById("syncButton").addEventListener("click", () => {
  setStatus("正在同步...");
  chrome.runtime.sendMessage({ type: "sync-now" }, (response) => {
    setStatus(response?.ok ? "同步完成" : `同步失败: ${response?.error || "unknown"}`);
  });
});
