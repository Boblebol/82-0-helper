import { copyFileSync, mkdirSync } from "node:fs";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: "src/content/index.ts",
      output: {
        entryFileNames: "content.js",
        format: "iife"
      }
    }
  },
  plugins: [
    {
      name: "copy-extension-manifest",
      closeBundle() {
        mkdirSync("dist", { recursive: true });
        copyFileSync("src/manifest.json", "dist/manifest.json");
      }
    }
  ]
});
