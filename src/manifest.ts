import type { ManifestV3Export } from "@crxjs/vite-plugin";

export default {
  manifest_version: 3,

  name: "BrainRest",

  version: "1.0.0",

  description: "Train your brain to rest better!",

  permissions: [],

  // action:{
  //     default_popup:"src/popup/index.html"
  // },

  // background:{
  //     service_worker:"src/background/service-worker.ts",
  //     type:"module"
  // },

  content_scripts: [
    {
      matches: ["<all_urls>"],
    },
  ],
} satisfies ManifestV3Export;
