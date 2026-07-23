/** Common fields shared by all tracked events */
export interface Event {
  /** Timestamp (ms) when the event occurred */
  timestamp: number
  /** Discriminant literal */
  type:string
}
