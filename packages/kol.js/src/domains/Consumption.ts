import { Item } from "data-of-loathing";

import type { Client } from "../Client.js";
import { type ActionResult, defineAction } from "../interceptors/action.js";
import { resolveEntityId } from "../utils/utils.js";

function detectSuccess(body: string): boolean {
  return (
    body.includes("You acquire") ||
    body.includes("You gain") ||
    (!body.includes("You don't have that item") &&
      !body.includes("You can't eat") &&
      !body.includes("You can't drink") &&
      !body.includes("You can't use") &&
      !body.includes("too full") &&
      !body.includes("too drunk"))
  );
}

function failReason(body: string, verb: string): string {
  return (
    body.match(
      /(?:You can't (?:eat|drink|use)|too (?:full|drunk))[^<]*/,
    )?.[0] ?? `Failed to ${verb}`
  );
}

const eatAction = defineAction({
  path: "inv_eat.php",
  parse({ body, success, failure }) {
    if (!detectSuccess(body)) return failure(failReason(body, "eat"));
    return success({});
  },
  onSuccess({ client }) {
    client.inventory.get.invalidate();
  },
});

const drinkAction = defineAction({
  path: "inv_booze.php",
  parse({ body, success, failure }) {
    if (!detectSuccess(body)) return failure(failReason(body, "drink"));
    return success({});
  },
  onSuccess({ client }) {
    client.inventory.get.invalidate();
  },
});

const useAction = defineAction({
  path: "inv_use.php",
  parse({ body, success, failure }) {
    if (!detectSuccess(body)) return failure(failReason(body, "use"));
    return success({});
  },
  onSuccess({ client }) {
    client.inventory.get.invalidate();
  },
});

const multiuseAction = defineAction({
  path: "multiuse.php",
  parse({ body, success, failure }) {
    if (!detectSuccess(body)) return failure(failReason(body, "use"));
    return success({});
  },
  onSuccess({ client }) {
    client.inventory.get.invalidate();
  },
});

export class Consumption {
  #client: Client;

  constructor(client: Client) {
    this.#client = client;
    client.interceptors.add(eatAction, drinkAction, useAction, multiuseAction);
  }

  async eat(item: Item | number, quantity = 1): Promise<ActionResult<object>> {
    return eatAction.perform(this.#client, {
      query: { which: 1, whichitem: resolveEntityId(item), quantity, ajax: 1 },
    });
  }

  async drink(
    item: Item | number,
    quantity = 1,
  ): Promise<ActionResult<object>> {
    return drinkAction.perform(this.#client, {
      query: { which: 1, whichitem: resolveEntityId(item), quantity, ajax: 1 },
    });
  }

  async use(item: Item | number, quantity = 1): Promise<ActionResult<object>> {
    const itemId = resolveEntityId(item);
    if (quantity > 1) {
      // action=useitem is not optional. Without it multiuse.php answers with an
      // ordinary page and consumes nothing, so the call looks like it worked
      // and did not.
      return multiuseAction.perform(this.#client, {
        query: {
          which: 1,
          whichitem: itemId,
          action: "useitem",
          quantity,
          ajax: 1,
        },
      });
    }
    return useAction.perform(this.#client, {
      query: { which: 1, whichitem: itemId, ajax: 1 },
    });
  }
}
