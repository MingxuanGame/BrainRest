import type { BaseEvent } from './BaseEvent'

/** Fired when a media element is played or paused */
export interface MediaEvent extends BaseEvent {
  /** The tab where the media is playing */
  tab_id: number
  /** Whether the media is currently paused */
  paused: boolean
  /** URL of the page or media source */
  url: string
}
