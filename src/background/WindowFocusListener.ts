import {createEvent} from "../models/events/Event";
import type {WindowFocus} from "../models/events/WindowFocus";
import {queue} from "./EventQueue";
import {engine} from "./engine/CognitiveLoadEngine";

chrome.windows.onFocusChanged.addListener((windowId) => {
    const focused = windowId !== chrome.windows.WINDOW_ID_NONE;

    queue.push(createEvent<WindowFocus>({
        type: focused ? "focus" : "blur",
        windowId,
        url: "",
    }));

    // 通知引擎窗口焦点状态变化（用于 SessionTracker 和打断抑制）
    engine.setWindowFocused(focused);
});
