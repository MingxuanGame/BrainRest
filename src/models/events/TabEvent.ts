import type { BaseEvent } from './BaseEvent'

/** Base interface for all browser tab lifecycle events */
export interface TabEvent extends BaseEvent {
  /** The unique ID assigned by Chrome to the tab */
  tabId: number
  /** The URL of the tab at the time of the event */
  url: string
}
