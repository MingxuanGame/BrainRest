import OpenAI from "openai";
import type { Option } from "../models/Option";

export let client: OpenAI | null = null;
const baseUrls: Record<string, string> = {
    openai: "https://api.openai.com/v1",
    deepseek: "https://api.deepseek.com/v1",
};

export function initClient(aiProvider: Option["aiProvider"], apiKey: Option["apiKey"]) {
    client = new OpenAI({ baseURL: baseUrls[aiProvider] || aiProvider, apiKey });
}
