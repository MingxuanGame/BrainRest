import type { TabEvent } from './TabEvent'

/** Fired when a new tab is created */
export interface TabCreated extends TabEvent {
  /** Discriminant literal */
  type: 'tab_created'
}
