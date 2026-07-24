import type {Event} from "./Event";

export interface WindowFocus extends Event {
    /** Discriminant literal */
    type: "focus" | "blur";
    /** The ID of the focused window, or chrome.windows.WINDOW_ID_NONE (-1) when all windows lost focus */
    windowId: number;
}
