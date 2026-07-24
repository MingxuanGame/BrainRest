import type { TabEvent } from './TabEvent'

/** Fired when the user switches the active tab (chrome.tabs.onActivated) */
export interface TabActivated extends TabEvent {
    /** Discriminant literal */
    type: 'tab_activated'
    /** The window that owns the newly activated tab */
    windowId: number
}
