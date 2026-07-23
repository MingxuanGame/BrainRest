import type { Event } from './Event'

/** Base interface for all browser tab lifecycle events */
export interface TabEvent extends Event {
  /** The unique ID assigned by Chrome to the tab */
  tabId: number
}
