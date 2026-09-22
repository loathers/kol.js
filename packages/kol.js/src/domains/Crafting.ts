import { Item } from "data-of-loathing";

import type { Client } from "../Client.js";
import { resolveEntityId } from "../utils/utils.js";

/**
 * craft.php — combining two items into a third.
 *
 * Costs meat sometimes and an adventure never (for the ordinary modes). A
 * surprising amount of the early game is gated behind it: a bitchin' meatcar,
 * which the Desert Beach needs, is six combines deep.
 */
export class Crafting {
  #client: Client;

  constructor(client: Client) {
    this.#client = client;
  }

  /** Combine two items. */
  async combine(
    a: Item | number,
    b: Item | number,
    quantity = 1,
  ): Promise<boolean> {
    const html = await this.#client.fetchText("craft.php", {
      form: {
        mode: "combine",
        action: "craft",
        a: resolveEntityId(a),
        b: resolveEntityId(b),
        qty: quantity,
      },
    });
    return Crafting.parseResult(html);
  }

  /**
   * Make meat paste, a meat stack or a dense meat stack out of Meat itself.
   *
   * The crafting page calls this "Make Meat Stuff". It is its own form rather
   * than an ordinary combine, because there is no second item.
   */
  async makeMeatStuff(item: Item | number, quantity = 1): Promise<boolean> {
    const html = await this.#client.fetchText("craft.php", {
      form: {
        action: "makepaste",
        whichitem: resolveEntityId(item),
        qty: quantity,
      },
    });
    return Crafting.parseResult(html);
  }

  static parseResult(html: string): boolean {
    return /You acquire/i.test(html);
  }
}
