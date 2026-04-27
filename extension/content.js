function getVisibleElements(selector) {
  return Array.from(document.querySelectorAll(selector)).filter((element) => {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  });
}

function findClickableByText(keywords) {
  const elements = getVisibleElements("button, a, [role='button'], [aria-label]");

  return elements.find((element) => {
    const text = `${element.textContent || ""} ${element.getAttribute("aria-label") || ""}`.trim().toLowerCase();
    return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
  });
}

function clickLikeButton() {
  const button = findClickableByText(["赞", "喜欢", "like", "upvote"]);

  if (!button) {
    return { ok: false, error: "没有找到可点击的点赞或喜欢按钮" };
  }

  button.click();
  return { ok: true, message: "已尝试点击点赞或喜欢按钮", url: location.href, title: document.title };
}

function setNativeValue(element, value) {
  const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value");

  if (descriptor?.set) {
    descriptor.set.call(element, value);
  } else {
    element.value = value;
  }
}

function fillComment(comment) {
  const input = getVisibleElements("textarea, input[type='text'], [contenteditable='true']")[0];

  if (!input) {
    return { ok: false, error: "没有找到可输入评论的文本框" };
  }

  input.focus();

  if (input.isContentEditable) {
    input.textContent = comment;
  } else {
    setNativeValue(input, comment);
  }

  input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: comment }));
  input.dispatchEvent(new Event("change", { bubbles: true }));

  return { ok: true, message: "已尝试填入评论内容", url: location.href, title: document.title };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "ping-page") {
    sendResponse({ ok: true, title: document.title, url: location.href });
    return true;
  }

  if (message?.type === "execute-page-action") {
    if (message.action === "like") {
      sendResponse(clickLikeButton());
      return true;
    }

    if (message.action === "comment") {
      sendResponse(fillComment(message.payload?.comment || ""));
      return true;
    }

    sendResponse({ ok: false, error: `Unsupported page action ${message.action}` });
    return true;
  }

  return false;
});
