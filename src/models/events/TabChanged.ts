import type { TabEvent } from './TabEvent'

/** Fired when a tab navigates to a new URL */
export interface TabChanged extends TabEvent {
  /** Discriminant literal */
  type: 'tab_changed'
  /** The previous URL before navigation */
  old_url: string
  /** The new URL after navigation */
  new_url: string
}
