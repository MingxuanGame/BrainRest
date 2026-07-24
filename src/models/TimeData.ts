/** Top-level time-tracking data for a session */
export interface TimeData {
    /** Session start timestamp (ms) */
    startTime: number;
    /** Session end timestamp (ms) */
    endTime: number;
    /** Per-domain time ranges */
    apps: Record<string, TimeRange[]>;
}

/** A time interval: [start, end] where end is null if ongoing */
export type TimeRange = [number, number | null];
