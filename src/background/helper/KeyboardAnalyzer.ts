import {queue} from "../EventQueue";
import type {Event} from "../../models/events/Event";
import type {UiKeyEvent} from "../../models/events/UiKeyEvent";

function isKeyDownEvent(event: Event): event is UiKeyEvent {
    return event.type === "keydown";
}

function isShortcut(event: UiKeyEvent): boolean {
    // Shift is intentionally retained because it is part of normal text input.
    return event.ctrlKey || event.altKey || event.metaKey;
}

/**
 * Returns Backspace/Delete presses divided by all non-shortcut key presses
 * in the current five-second event window. Returns 0 when no keys qualify.
 */
export function calculateDeleteKeyRatio(): number {
    let totalKeyPresses = 0;
    let deleteKeyPresses = 0;

    for (const event of queue.getEvents()) {
        if (!isKeyDownEvent(event) || isShortcut(event)) continue;

        totalKeyPresses++;
        if (event.key === "Backspace" || event.key === "Delete") {
            deleteKeyPresses++;
        }
    }

    return totalKeyPresses === 0 ? 0 : deleteKeyPresses / totalKeyPresses;
}
