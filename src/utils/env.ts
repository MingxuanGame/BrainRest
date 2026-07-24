/**
 * 判断当前是否运行在开发环境。判定规则（任一命中即为开发环境）：
 * 1. Vite dev server（npm run dev）
 * 2. 非扩展上下文的本地网页预览（vite preview，无 chrome.runtime）
 * 3. 以「加载已解压的扩展程序」方式安装（manifest 无 update_url）
 *
 * 商店分发的正式安装（manifest 带 update_url）判定为生产环境，
 * 调试/测试面板会从 UI 与消息通道两侧整体屏蔽。
 */
export function isDevEnvironment(): boolean {
    if (import.meta.env.DEV) {
        return true;
    }
    if (typeof chrome === "undefined" || !chrome.runtime?.id) {
        return true;
    }
    return !("update_url" in chrome.runtime.getManifest());
}
