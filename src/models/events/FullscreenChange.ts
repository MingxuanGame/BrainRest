import type { Event } from "./Event";

/** Fired when the page enters or exits fullscreen (e.g. video fullscreen) */
export interface FullscreenChange extends Event {
    /** Discriminant literal */
    type: "fullscreen_change";
    /** Whether an element is currently in fullscreen */
    active: boolean;
}
