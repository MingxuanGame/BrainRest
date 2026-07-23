import type { TabEvent } from './TabEvent'

export interface TabChanged extends TabEvent {
  type: 'changed'
  old_url: string
  new_url: string
}
