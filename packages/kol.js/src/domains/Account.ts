import type { Client } from "../Client.js";
import { type ActionResult, defineAction } from "../interceptors/action.js";

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
}
