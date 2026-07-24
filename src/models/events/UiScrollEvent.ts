import type { UiEvent } from "./UiEvent";

/** Scroll event data */
export interface UiScrollEvent extends UiEvent {
    /** Discriminant literal */
    type: "scroll";
    /** Horizontal scroll offset in pixels */
    scrollX: number;
    /** Vertical scroll offset in pixels */
    scrollY: number;
}
