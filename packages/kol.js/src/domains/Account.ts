import type { Client } from "../Client.js";
import { type ActionResult, defineAction } from "../interceptors/action.js";
import type { CombatMacro } from "./CombatMacros.js";

// `string & {}` keeps the literal suggestions for autocomplete without
// collapsing the union to a bare `string`.
export type AccountFlag = "ignorezonewarnings" | "aabosses" | (string & {});

const setFlagAction = defineAction({
  path: "account.php",
  matches: (req) => {
    const action = req.params.get("action") ?? "";
    return action.startsWith("flag_") || action === "autoattack";
  },
  parse({ body, success, failure }) {
    if (body.includes("Error") || body.includes("Invalid"))
      return failure("Failed to update account setting");
    return success({});
  },
});

export class Account {
  #client: Client;

  constructor(client: Client) {
    this.#client = client;
  }

  async setFlag(
    flag: AccountFlag,
    value: 0 | 1,
  ): Promise<ActionResult<object>> {
    return setFlagAction(this.#client, {
      query: { am: 1, action: `flag_${flag}`, value, ajax: 1 },
    });
  }

  async setAutoattack(macroId: number): Promise<ActionResult<object>> {
    return setFlagAction(this.#client, {
      query: { am: 1, action: "autoattack", value: macroId, ajax: 1 },
    });
  }

  /**
   * Parse the combat macros offered by the combat tab's autoattack dropdown.
   *
   * The ids here are the option values, which are what setAutoattack()
   * expects. For combat macros they are not the same as the ids used by
   * account_combatmacros.php.
   */
  static parseAutoattackMacros(html: string): {
    options: CombatMacro[];
    selected: CombatMacro | null;
  } {
    // Only matches combat macros, not skills. The unselected form has two
    // spaces before value (<option  value="...">), hence \s+.
    const matches = html.matchAll(
      /<option( selected="selected")?\s+value="(\d+)">([^<]*?) \(Combat Macro\)<\/option>/g,
    );

    const options: CombatMacro[] = [];
    let selected: CombatMacro | null = null;

    for (const [, isSelected, id, name] of matches) {
      const macro = { id: Number(id), name };
      options.push(macro);
      if (isSelected) selected = macro;
    }

    return { options, selected };
  }

  async #fetchCombatTab(): Promise<string> {
    return await this.#client.fetchText("account.php", {
      query: { action: "loadtab", value: "combat" },
    });
  }

  /** All combat macros available as autoattacks. */
  async getAutoattackMacros(): Promise<CombatMacro[]> {
    return Account.parseAutoattackMacros(await this.#fetchCombatTab()).options;
  }

  /** The currently selected autoattack, if it is a combat macro. */
  async getAutoattackMacro(): Promise<CombatMacro | null> {
    return Account.parseAutoattackMacros(await this.#fetchCombatTab()).selected;
  }
}
