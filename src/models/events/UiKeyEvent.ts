import type { UiEvent } from './UiEvent'

/** Keyboard key press event data */
export interface UiKeyEvent extends UiEvent {
    /** Discriminant literal */
    type: 'keydown' | 'keyup'
    /** The key value (e.g. 'a', 'Enter') */
    key: string
    /** Physical key code (e.g. 'KeyA', 'Enter') */
    code: string
    /** Whether the Alt key was held */
    altKey: boolean
    /** Whether the Ctrl key was held */
    ctrlKey: boolean
    /** Whether the Shift key was held */
    shiftKey: boolean
    /** Whether the Meta (Win/Cmd) key was held */
    metaKey: boolean
}
