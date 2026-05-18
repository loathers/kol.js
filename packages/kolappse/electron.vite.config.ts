import { execSync } from "child_process";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import { resolve } from "path";

const commitHash = (() => {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "unknown";
  }
})();

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
    define: {
      __COMMIT_HASH__: JSON.stringify(commitHash),
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
