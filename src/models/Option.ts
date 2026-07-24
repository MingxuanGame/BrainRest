import type { AbsoluteUrl } from './types'

export interface Option {
    aiProvider: 'openai' | 'deepseek' | AbsoluteUrl // TODO: add more providers
    categorifyModel: string
    apiKey: string
}
