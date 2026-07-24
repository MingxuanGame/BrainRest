import type { UiEvent } from "./UiEvent";

/** Mouse position sampled while the pointer moves over the page. */
export interface UiMouseMoveEvent extends UiEvent {
    type: "mousemove";
    /** X coordinate relative to the viewport */
    clientX: number;
    /** Y coordinate relative to the viewport */
    clientY: number;
}
