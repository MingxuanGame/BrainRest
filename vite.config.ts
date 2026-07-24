import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import {crx} from "@crxjs/vite-plugin";
import manifest from "./src/manifest.ts";

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        react(),
        crx({
            manifest,
            contentScripts: {
                standaloneFiles: ["src/content/index.ts"],
            },
        }),
    ],
    build: {
        sourcemap: true,
        minify: false,
    },
    server: {
        sourcemapIgnoreList: () => false,
    },
});
