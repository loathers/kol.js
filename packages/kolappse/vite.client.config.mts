import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { defineConfig } from "vite";
import cssInjectedByJsPlugin from "vite-plugin-css-injected-by-js";

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    // CSS must be bundled into the JS file for the injected script approach;
    // only needed for the production build — dev mode handles CSS via HMR
    ...(mode === "production" ? [cssInjectedByJsPlugin()] : []),
  ],
  root: resolve(__dirname, "src/client"),
  server: {
    port: 5174,
    cors: true,
  },
  // process.env shims for libraries that reference it — production only
  define:
    mode === "production"
      ? {
          "process.env.NODE_ENV": JSON.stringify("production"),
          "process.env": JSON.stringify({ NODE_ENV: "production" }),
          process: JSON.stringify({ env: { NODE_ENV: "production" } }),
        }
      : {},
  build: {
    rollupOptions: {
      input: resolve(__dirname, "src/client/index.tsx"),
      onwarn(warning, warn) {
        if (warning.code === "MODULE_LEVEL_DIRECTIVE") return;
        warn(warning);
      },
      output: {
        format: "es",
        entryFileNames: "kolappse.js",
        inlineDynamicImports: true,
      },
    },
    outDir: resolve(__dirname, "resources"),
    emptyOutDir: false,
    cssCodeSplit: false,
  },
}));
