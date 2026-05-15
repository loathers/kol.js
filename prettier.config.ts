import type { Config } from "prettier";

const config: Config = {
  importOrder: ["^[^./]", "^[./]"],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
  importOrderParserPlugins: ["typescript"],
  plugins: ["@trivago/prettier-plugin-sort-imports"],
};

export default config;
