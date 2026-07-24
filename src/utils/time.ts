export function formatDuration(d: number | [number, number]): string {
    return Array.isArray(d) ? `${d[0]}–${d[1]} 分钟` : `${d} 分钟`
}
