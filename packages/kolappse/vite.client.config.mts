import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { defineConfig } from "vite";
import cssInjectedByJsPlugin from "vite-plugin-css-injected-by-js";

export default defineConfig({
  plugins: [react(), cssInjectedByJsPlugin()],
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
    "process.env": JSON.stringify({ NODE_ENV: "production" }),
    "process": JSON.stringify({ env: { NODE_ENV: "production" } }),
  },
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === "MODULE_LEVEL_DIRECTIVE") return;
        warn(warning);
      },
      output: {
        inlineDynamicImports: true,
      },
    },
    lib: {
      entry: resolve(__dirname, "src/client/index.tsx"),
      name: "KolappsePalette",
      formats: ["iife"],
      fileName: () => "palette.js",
    },
    outDir: resolve(__dirname, "resources"),
    emptyOutDir: false,
    cssCodeSplit: false,
  },
});
