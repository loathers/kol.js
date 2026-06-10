import type { Client } from "../Client.js";
import { type ActionResult, defineAction } from "../interceptors/action.js";

export type CombatMacro = { id: number; name: string };

const saveMacroAction = defineAction({
  path: "account_combatmacros.php",
  matches: (req) => req.params.get("action") === "save",
  parse({ body, success, failure }) {
    const savedId = body.match(/macroid=(\d+)/)?.[1];
    if (!savedId) return failure("Failed to save macro");
    return success({ id: Number(savedId) });
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
    const html = await this.#client.fetchText("account_combatmacros.php", {
      query: { macroid: id },
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
      form: { macroid: id, macroname: name, macrotext: text, action: "save" },
    });
  }
}
