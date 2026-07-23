type AbsoluteUrl = `http://${string}` | `https://${string}`;

export interface Option {
  aiProvider: 'openai' | 'deepseek' | AbsoluteUrl;  // TODO: add more providers
  categorifyModel: string;
  apiKey: string;
}