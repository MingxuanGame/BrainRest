/** Common fields shared by all tracked events */
export interface Event {
    /** Timestamp (ms) when the event occurred */
    timestamp: number;
    /** Discriminant literal */
    type: string;
    /** flags the event as processed (0 = unprocessed, 1 = processed) */
    processed: 0 | 1;
    /** URL of the page where the event occurred */
    url: string;
}

export function createEvent<T extends Event>(fields: Omit<T, 'processed' | 'timestamp'>): T {
    return {
        processed: 0,
        timestamp: Date.now(),
        ...fields,
    } as T
}

