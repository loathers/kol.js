import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";

const kolJsSrc = resolve(__dirname, "../kol.js/src");

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ["kol.js"] })],
    resolve: {
      alias: {
        "kol.js": resolve(kolJsSrc, "index.ts"),
      },
    },
    server: {
      watch: {
        // chokidar ignores node_modules by default; un-ignore the kol.js symlink
        // so changes to the library source trigger a hot restart
        ignored: (p: string) =>
          p.includes("node_modules") && !p.startsWith(kolJsSrc),
      },
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "src/main/index.ts"),
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "src/preload/index.ts"),
        },
      },
    },
  },
});
