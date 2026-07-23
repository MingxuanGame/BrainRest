import type { ManifestV3Export } from "@crxjs/vite-plugin";

export default {
  manifest_version: 3,

  name: "BrainRest",

  version: "1.0.0",

  description: "Train your brain to rest better!",

  key: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtOJD4W6D9DYW1cnKXQHBxVkRSbT0LF1wFzzHRGQ4sUt6NL3Z+cyJn8gZX5BNzB+Fd07xxBrfgiMeE4bi9yyQp/2nbfP8rUj5JVxhf87UAvc7AJEk+zcuPxrbPMaOcyY5dPZSfrSY2X3OImx9PfGWVRtUq1/pOOV4gd7JpqcnxseplSNQnHZMxzpa7fDgRaAc664sLXs++hUT/f/ay6Oo8N6JL+q+0chPUscptwH2L+ho76871pjoqlqFImjh6lLJzRI0GdgN1frH3CNghReYQmjmwqbeDwrYtYYa3TbDZZY24TM6Fga79Ffan8ya8wPUgbLgvKBJE0tv7P/HwoikCQIDAQAB",

  permissions: ["tabs", "windows", "storage"],

  // action:{
  //     default_popup:"src/popup/index.html"
  // },

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
