import type {Option} from "../models/Option";
import type {UrlCategory} from "../models/types";
import {client, initClient} from "./AI";
import {urlCategoryDB} from "./UrlCategoryDataBaseManager";
import {loadOption} from "./OptionStore";

const categorifyPrompt = `
You are a website URL classifier. You will be given a URL and the HTML content of its corresponding web page. Based on both, determine the category that the URL belongs to.

# Input
- URL: the full URL to classify
- HTML: the HTML content of the page at that URL

# Available Categories

- short_video_entertainment — Short-Video Entertainment: TikTok/Douyin, Kuaishou, Bilibili short clips, WeChat Channels, Reels, Shorts.
- social_feed — Social Information Feed: Xiaohongshu (RED), Weibo, WeChat Moments, Zhihu activity, X (Twitter), comment/interaction platforms.
- competitive_progression_games — Competitive/Progression Games: MOBA, FPS, open-world, card-collection/progression, casual match-three games.
- deep_work_productivity — Deep-Cognition Productivity: Word/Excel/PPT, coding IDEs, online docs, mind maps, professional drawing software.
- longform_deep_reading — Long-Form Deep Reading: e-books, academic paper readers, long-form novels, professional knowledge apps.
- passive_long_video — Passive Long-Video Viewing: Netflix, Tencent Video, iQIYI long series, documentaries, non-interactive film & TV.
- im_social_adjunct — Multitasking Social Adjunct: Real-time messaging apps (WeChat / QQ / DingTalk) → frequent message switching and high-frequency emotional fluctuation; folded into the social feed branch.
- hybrid_learning_cognition — Hybrid Cognition: Online courses / live teaching → both passive audiovisual stimulation and prefrontal focus; split the tracked duration when accounting.
- low_load_utility — Low-Load Utility: Tools (calculator, notes, maps) → brief single-shot prefrontal activation, no long-term fatigue risk.
- shopping_reward_social — Hybrid Reward-Social: Shopping/product-seeding apps → short-video seeding plus instant purchase reward; activates both the reward loop and the amygdala.
- audio_low_visual — Low-Visual-Load Audio: Audio podcasts / pure music apps → almost no occipital activation, mild temporal-lobe auditory work.

# Classification Rules
1. Analyze both the URL structure and the HTML content (title, meta tags, body text, navigation, etc.) to determine the page's true purpose. Do not guess based on the domain name alone.
2. Extract the "smallest domain-level URL that represents this category":
   - If the entire root domain serves a single category, use the root domain (e.g., bilibili.com).
   - If different subdomains/subsites under the root domain belong to different categories, use the smallest subdomain that scopes this category (e.g., use tieba.baidu.com for Baidu Tieba, not baidu.com).
   - Keep only the domain part. Remove the protocol (http/https), the www prefix, paths, query parameters, and anchors.
3. The category MUST be one of the short labels defined in "Available Categories" (e.g., short_video_entertainment). Do not invent new categories.

# Output Format (STRICTLY two lines. Output nothing else: no explanation, no extra text, no punctuation, no blank lines)
Line 1: the smallest domain-level URL representing the category
Line 2: the short category label of this URL

# Example
Input URL: https://tieba.baidu.com/f?kw=games
Output:
tieba.baidu.com
social_feed

Now classify the following input:
URL: {{url}}
HTML: {{html}}
`;

export async function categorifyModel(
    model: Option["categorifyModel"],
    url: string,
    html: string,
): Promise<{ domain: string; category: UrlCategory }> {
    const prompt = categorifyPrompt
        .replace("{{url}}", url)
        .replace("{{html}}", html);
    if (!client) {
        throw new Error("AI client not initialized. Call initClient first.");
    }
    const response = await client.chat.completions.create({
        model,
        messages: [
            {
                role: "system",
                content: "You are a helpful assistant.",
            },
            {
                role: "user",
                content: prompt,
            },
        ],
    });
    const output = response.choices[0].message?.content;
    if (!output) {
        throw new Error("No output from AI model.");
    }
    const [domain, category] = output.split("\n");
    if (!domain || !category) {
        throw new Error("Invalid output format from AI model.");
    }
    if (
        ![
            "short_video_entertainment",
            "social_feed",
            "competitive_progression_games",
            "deep_work_productivity",
            "longform_deep_reading",
            "passive_long_video",
            "im_social_adjunct",
            "hybrid_learning_cognition",
            "low_load_utility",
            "shopping_reward_social",
            "audio_low_visual",
        ].includes(category)
    ) {
        throw new Error("Invalid category from AI model.");
    }
    return {domain, category: category as UrlCategory};
}

/** 从完整 URL 中提取规范化域名（去除协议、www 前缀、端口、路径） */
function extractDomain(url: string): string | null {
    try {
        const hostname = new URL(url).hostname.toLowerCase();
        return hostname.replace(/^www\./, "");
    } catch {
        return null;
    }
}

async function getCategoryFromDB(
    url: string,
): Promise<{ domain: string; category: UrlCategory } | null> {
    const domain = extractDomain(url);
    if (!domain) {
        return null;
    }
    const record = await urlCategoryDB.lookup(domain);
    if (!record) {
        return null;
    }
    return {domain: record.domain, category: record.category};
}

export async function getCategory(
    url: string,
    html: string,
    option?: Option,
): Promise<{ domain: string; category: UrlCategory }> {
    const opt = option ?? (await loadOption());

    const cached = await getCategoryFromDB(url);
    if (cached) {
        return cached;
    }

    initClient(opt.aiProvider, opt.apiKey);
    const result = await categorifyModel(opt.categorifyModel, url, html);

    try {
        await urlCategoryDB.put(result.domain, result.category);
    } catch {
        // 写入失败不影响主流程
    }

    return result;
}

export async function setCategory(
    domain: string,
    category: UrlCategory,
    option?: Option,
): Promise<void> {
    const opt = option ?? (await loadOption());
    initClient(opt.aiProvider, opt.apiKey);
    try {
        await urlCategoryDB.put(domain, category);
    } catch (e: unknown) {
        throw new Error("Failed to set category in database: " + (e as Error).message, {cause: e});
    }
}
