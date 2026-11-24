import { gameData } from "kol.js";
import type { EvaluatedModifier, Interceptor, KolResponse } from "kol.js";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { loadAccounts } from "./credentials.js";

function json(data: unknown): KolResponse {
  return {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(data),
  };
}

function error(status: number, message: string): KolResponse {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify({ error: message }),
  };
}

const kolappsePath = join(__dirname, "../../resources/kolappse.js");

export function apiHandlers(options: {
  onLogin: (username: string) => Promise<void>;
}): Interceptor[] {
  return [
    {
      path: "_kolappse/kolappse.js",
      async handle() {
        return {
          status: 200,
          contentType: "application/javascript",
          body: await readFile(kolappsePath, "utf8"),
        };
      },
    },

    {
      path: "_kolappse/api/flags",
      async handle(client) {
        return json(client.flags.export());
      },
    },

    {
      path: "_kolappse/api/accounts",
      handle() {
        return json(
          loadAccounts().map(({ username, playerId, lastLoginAt }) => ({
            username,
            playerId,
            lastLoginAt,
          })),
        );
      },
    },

    {
      path: "_kolappse/api/me",
      async handle(client) {
        return json({ username: client.username, playerId: client.playerId });
      },
    },

    {
      path: "_kolappse/api/login",
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
    },

    {
      path: "_kolappse/api/inventory",
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
    },

    {
      path: "_kolappse/api/item",
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
    },
  ];
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
