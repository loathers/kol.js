import { gameData, registerInterceptor } from "kol.js";
import type { EvaluatedModifier, ProxyResponse } from "kol.js";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

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
        loadAccounts().map(({ username, playerId, lastLoginAt }) => ({
          username,
          playerId,
          lastLoginAt,
        })),
      );
    },
  });

  registerInterceptor({
    matches: (req) => req.path === "_kolappse/api/me",
    async handle(client) {
      return json({ username: client.username, playerId: client.playerId });
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

  registerInterceptor({
    matches: (req) => req.path === "_kolappse/api/item",
    async handle(client, req) {
      const idParam = req.params.get("id");
      if (!idParam) return error(400, "id required");
      const id = parseInt(idParam, 10);
      if (isNaN(id)) return error(400, "id must be a number");

      try {
        const [item, modifiers] = await Promise.all([
          gameData.findItemWithDetailById(id),
          client.modifiers.evaluateItem(id),
        ]);
        if (!item) return error(404, "item not found");

        const serializedModifiers = [...modifiers.entries()].map(
          ([name, mod]) => serializeModifier(name, mod),
        );

        return json({
          id: item.id,
          name: item.name,
          image: item.image,
          uses: item.uses,
          equipment: item.equipment
            ? {
                power: item.equipment.power,
                type: item.equipment.type ?? null,
                hands: item.equipment.hands ?? null,
                musRequirement: item.equipment.musRequirement,
                mysRequirement: item.equipment.mysRequirement,
                moxRequirement: item.equipment.moxRequirement,
              }
            : null,
          consumable: item.consumable
            ? {
                stomach: item.consumable.stomach,
                liver: item.consumable.liver,
                spleen: item.consumable.spleen,
                levelRequirement: item.consumable.levelRequirement,
                quality: item.consumable.quality ?? null,
                adventureRange: item.consumable.adventureRange,
                notes: item.consumable.notes ?? null,
              }
            : null,
          modifiers: serializedModifiers,
        });
      } catch {
        return error(503, "not logged in");
      }
    },
  });
}

function serializeModifier(
  name: string,
  mod: EvaluatedModifier,
): Record<string, unknown> {
  switch (mod.kind) {
    case "numeric":
      return { name, kind: "numeric", value: mod.value };
    case "boolean":
      return { name, kind: "boolean", value: mod.value };
    case "string":
      return { name, kind: "string", value: mod.value };
    case "string[]":
      return { name, kind: "string[]", values: mod.values };
    case "effect-grants":
      return { name, kind: "effect-grants", grants: mod.grants };
    case "range":
      return { name, kind: "range", min: mod.min, max: mod.max };
  }
}
