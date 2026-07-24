import type { ManifestV3Export } from "@crxjs/vite-plugin";

export default {
    manifest_version: 3,

    name: "BrainRest",

    version: "1.0.0",

    description: "Train your brain to rest better!",

    key: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtOJD4W6D9DYW1cnKXQHBxVkRSbT0LF1wFzzHRGQ4sUt6NL3Z+cyJn8gZX5BNzB+Fd07xxBrfgiMeE4bi9yyQp/2nbfP8rUj5JVxhf87UAvc7AJEk+zcuPxrbPMaOcyY5dPZSfrSY2X3OImx9PfGWVRtUq1/pOOV4gd7JpqcnxseplSNQnHZMxzpa7fDgRaAc664sLXs++hUT/f/ay6Oo8N6JL+q+0chPUscptwH2L+ho76871pjoqlqFImjh6lLJzRI0GdgN1frH3CNghReYQmjmwqbeDwrYtYYa3TbDZZY24TM6Fga79Ffan8ya8wPUgbLgvKBJE0tv7P/HwoikCQIDAQAB",

    permissions: ["tabs", "windows", "storage", "idle", "alarms"],

    // background service worker 调用 AI 接口需要 host 权限；
    // 自定义 aiProvider 为其他绝对 URL 时需在此追加对应 host
    host_permissions: ["https://api.openai.com/*", "https://api.deepseek.com/*"],

    action: {
        default_popup: "index.html",
    },

    options_ui: {
        page: "options.html",
        open_in_tab: true,
    },

    background: {
        service_worker: "src/background/service-worker.ts",
        type: "module",
    },

    content_scripts: [
        {
            matches: ["<all_urls>"],
            js: ["src/content/index.ts"],
        },
    ],
} satisfies ManifestV3Export;
