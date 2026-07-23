import type { BaseEvent } from './BaseEvent'

/** Base interface for all captured UI interaction events */
export interface UiEvent extends BaseEvent {
  /** The event type (e.g. 'click', 'scroll') */
  type: string
  /** Tag name of the target element */
  targetTag?: string
  /** ID attribute of the target element */
  targetId?: string
  /** Class name(s) of the target element */
  targetClass?: string
}
