import type { Event } from './Event'

/** Fired when a media element is played or paused */
export interface MediaEvent extends Event {
    /** Discriminant literal */
    type: 'media'
    /** The tab where the media is playing */
    tab_id: number
    /** Whether the media is currently paused */
    paused: boolean
    /** URL of the page or media source */
    url: string
}
