/**
 * 从完整 URL 中提取规范化域名：去除协议、www 前缀、端口、路径，转小写。
 * 解析失败返回 null。
 */
export function extractDomain(url: string): string | null {
    try {
        const hostname = new URL(url).hostname.toLowerCase()
        return hostname.replace(/^www\./, '')
    } catch {
        return null
    }
}
