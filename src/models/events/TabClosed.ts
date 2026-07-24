import type {TabEvent} from './TabEvent'

/** Fired when a tab is closed */
export interface TabClosed extends TabEvent {
    /** Discriminant literal */
    type: 'tab_closed'
}
