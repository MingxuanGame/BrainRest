/** Common fields shared by all tracked events */
export interface Event {
  /** Timestamp (ms) when the event occurred */
  timestamp: number
  /** Discriminant literal */
  type:string
  /** flags the event as processed (0 = unprocessed, 1 = processed) */
  processed: 0 | 1
}
