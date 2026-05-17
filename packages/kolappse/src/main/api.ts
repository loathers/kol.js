import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { registerInterceptor } from "kol.js";
import type { ProxyResponse } from "kol.js";

function json(data: unknown): ProxyResponse {
  return {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(data),
  };
}

function error(status: number, message: string): ProxyResponse {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify({ error: message }),
  };
}

const palettePath = join(__dirname, "../../resources/palette.js");

export function registerApiHandlers(): void {

  registerInterceptor({
    matches: (req) => req.path === "_kolappse/palette.js",
    async handle() {
      return {
        status: 200,
        contentType: "application/javascript",
        body: await readFile(palettePath, "utf8"),
      };
    },
  });


  registerInterceptor({
    matches: (req) => req.path === "_kolappse/api/flags",
    async handle(client) {
      return json(client.flags.export());
    },
  });

  registerInterceptor({
    matches: (req) => req.path === "_kolappse/api/inventory",
    async handle(client) {
      try {
        const map = await client.inventory.get();
        const items = [...map.entries()].map(([item, qty]) => ({
          id: item.id,
          name: item.name,
          image: item.image,
          quantity: qty,
        }));
        return json(items);
      } catch {
        return error(503, "not logged in");
      }
    },
  });
}
