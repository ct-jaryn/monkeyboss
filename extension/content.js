chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "ping-page") {
    sendResponse({ ok: true, title: document.title, url: location.href });
  }
});
