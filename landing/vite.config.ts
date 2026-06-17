import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

const landingRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: landingRoot,
  publicDir: "public",
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
