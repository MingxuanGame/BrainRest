import type { TabEvent } from './TabEvent'

export interface TabClosed extends TabEvent {
  type: 'closed'
}
