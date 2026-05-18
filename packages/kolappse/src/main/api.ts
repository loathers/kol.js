import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { registerInterceptor } from "kol.js";
import type { ProxyResponse } from "kol.js";
import { loadAccounts } from "./credentials.js";

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

const kolappsePath = join(__dirname, "../../resources/kolappse.js");

export function registerApiHandlers(options: {
  onLogin: (username: string) => Promise<void>;
}): void {

  registerInterceptor({
    matches: (req) => req.path === "_kolappse/kolappse.js",
    async handle() {
      return {
        status: 200,
        contentType: "application/javascript",
        body: await readFile(kolappsePath, "utf8"),
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
    matches: (req) => req.path === "_kolappse/api/accounts",
    handle() {
      return json(
        loadAccounts().map(({ username, playerId }) => ({ username, playerId })),
      );
    },
  });

  registerInterceptor({
    matches: (req) => req.path === "_kolappse/api/login",
    async handle(_client, req) {
      const username = req.params.get("username");
      if (!username) return error(400, "username required");
      try {
        await options.onLogin(username);
        return json({ ok: true });
      } catch {
        return error(500, "login failed");
      }
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
