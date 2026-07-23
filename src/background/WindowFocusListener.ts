import type { WindowFocus } from "../models/events/WindowFocus";
import { queue } from "./EventQueue";

chrome.windows.onFocusChanged.addListener((windowId) => {
  const event: WindowFocus = {
    type: windowId === chrome.windows.WINDOW_ID_NONE ? "blur" : "focus",
    timestamp: Date.now(),
    windowId,
  };
  queue.push(event);
});
