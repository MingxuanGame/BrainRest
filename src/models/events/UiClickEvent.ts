import type { UiEvent } from "./UiEvent";

/** Mouse click event data */
export interface UiClickEvent extends UiEvent {
    /** Discriminant literal */
    type: "click";
    /** Which mouse button was pressed (0=left, 1=middle, 2=right) */
    button: number;
    /** X coordinate relative to the viewport */
    clientX: number;
    /** Y coordinate relative to the viewport */
    clientY: number;
}
