import "./TabListener";
import "./WindowFocusListener";
import {queue} from "./EventQueue";
import {getCategory} from "../services/CategoryService";
import {isCategorizeRequest, type CategorizeResponse} from "../messages";

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "event-stream") return;

  port.onMessage.addListener((event) => {
    queue.push(event);
  });
});

/**
 * 接收 content script 发来的分类请求，在 service worker 中执行 getCategory。
 * apiKey 只在 background 持有，页面上下文无法访问；分类结果落 IDB 供下游反查。
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isCategorizeRequest(message)) {
    return false;
  }
  void (async () => {
    try {
      const result = await getCategory(message.url, message.html);
      const response: CategorizeResponse = {
        ok: true,
        domain: result.domain,
        category: result.category,
      };
      sendResponse(response);
    } catch (e) {
      const response: CategorizeResponse = {
        ok: false,
        error: (e as Error).message,
      };
      sendResponse(response);
    }
  })();
  // 返回 true 以保持消息通道开启，等待异步 sendResponse
  return true;
});