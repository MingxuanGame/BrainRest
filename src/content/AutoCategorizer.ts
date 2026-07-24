import type { CategorizeRequest } from "../messages";

// 页面加载后 3s 自动分类（等待 UI 稳定再抽取 HTML，避免过早快照降低准召率）
window.addEventListener("load", () => {
    setTimeout(() => {
        void autoCategorize();
    }, 3000);
});

/**
 * content 仅向 background 中转 {url, html}，由 background 调用 getCategory（含本地库回溯与 AI 调用）。
 * 这样 apiKey 只在 service worker 中持有，页面上下文无法访问。
 * 分类结果由 background 写入 IndexedDB，下游（如 SwitchEntropyAnalyzer）按需反查，
 * 不进入事件流以免污染 UI 事件采集。
 */
async function autoCategorize(): Promise<void> {
    const request: CategorizeRequest = {
        type: "categorize",
        url: window.location.href,
        html: document.documentElement.outerHTML,
    };
    try {
        await chrome.runtime.sendMessage(request);
    } catch {
        // 中转失败静默忽略，不影响页面正常事件采集
    }
}
