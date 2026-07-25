import type { Client } from "../Client.js";
import { type ActionResult, defineAction } from "../interceptors/action.js";

export type CombatMacro = { id: number; name: string };

/** Find a macro's id in the macro management page by its name. */
export function findMacroId(html: string, name: string): number | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(
    new RegExp(`<option value="(\\d+)">${escaped}</option>`),
  );
  return match ? Number(match[1]) : null;
}

const saveMacroAction = defineAction<{ id: number }>({
  path: "account_combatmacros.php",
  matches: (req) => req.params.get("action") === "save",
  parse({ req, body, success, failure }) {
    // A successful save responds with the macro list page; find the saved
    // macro in it by name to confirm and learn its id.
    const id = findMacroId(body, req.params.get("name") ?? "");
    if (id === null) return failure("Failed to save macro");
    return success({ id });
  },
});

export class CombatMacros {
  #client: Client;

  constructor(client: Client) {
    this.#client = client;
  }

  async list(): Promise<CombatMacro[]> {
    const html = await this.#client.fetchText("account_combatmacros.php");
    return [...html.matchAll(/<option value="?(\d+)"?>([^<]+)<\/option>/g)].map(
      ([, id, name]) => ({ id: Number(id), name: name.trim() }),
    );
  }

  async getText(id: number): Promise<string> {
    // The editor only opens via the edit form POST, not a query parameter
    const html = await this.#client.fetchText("account_combatmacros.php", {
      method: "POST",
      form: { action: "edit", macroid: id, what: "Edit" },
    });
    return (
      html.match(/<textarea[^>]*>([\s\S]*?)<\/textarea>/i)?.[1]?.trim() ?? ""
    );
  }

  async save(
    name: string,
    text: string,
    id = 0,
  ): Promise<ActionResult<{ id: number }>> {
    return saveMacroAction(this.#client, {
      method: "POST",
      form: { macroid: id, name, macrotext: text, action: "save" },
    });
  }
}
