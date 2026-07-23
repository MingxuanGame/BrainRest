import { createEvent } from "../models/events/Event";
import type { WindowFocus } from "../models/events/WindowFocus";
import { queue } from "./EventQueue";

chrome.windows.onFocusChanged.addListener((windowId) => {
  queue.push(createEvent<WindowFocus>({
    type: windowId === chrome.windows.WINDOW_ID_NONE ? "blur" : "focus",
    windowId,
    url: "",
  }));
});
