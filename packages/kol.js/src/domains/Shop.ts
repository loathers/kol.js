import type { Client } from "../Client.js";

/**
 * shop.php — the NPC stores, and everything else built on the same page.
 *
 * A purchase posts `whichrow`, which is the shop's own handle on an offer and
 * has nothing to do with the item id: the general store sells item 2595 as row
 * 630. Buying by item id fetches a valid page and buys nothing.
 */

export type ShopEntry = {
  /** What a purchase posts. Unrelated to `itemId`. */
  row: number;
  itemId: number;
  /**
   * The name exactly as the page writes it, entities intact.
   *
   * data-of-loathing stores them the same way — item 2595 is
   * `Ben-Gal&trade; Balm` — so decoding here would stop the name matching
   * either the item tables or the inventory.
   */
  name: string;
  /**
   * How many the offer hands over, which the page writes after the name as
   * `(11)`. One where it says nothing.
   *
   * A shop row is not always a purchase: the Floral Mercantile Exchange trades
   * tulips for Chroner, so a row there means "pay 1 red tulip, get 11 Chroner".
   */
  quantity: number;
  /** What one costs, in `currency`. */
  price: number;
  /** What the price is in. "Meat" for the ordinary stores, an item elsewhere. */
  currency: string;
  /**
   * The currency's description id, where it is an item rather than Meat.
   * Names are ambiguous across the game; this is not.
   */
  currencyDescId: number | null;
};

const ROW = /<tr rel="(\d+)">([\s\S]*?)<\/tr>/gi;

export class Shop {
  #client: Client;

  constructor(client: Client) {
    this.#client = client;
  }

  /** What a shop is currently selling. */
  async getStock(shop: string): Promise<ShopEntry[]> {
    const html = await this.#client.fetchText("shop.php", {
      method: "GET",
      query: { whichshop: shop },
    });
    return Shop.parse(html);
  }

  /**
   * Buy `quantity` of one offer, by the row the shop lists it under.
   *
   * Take the row from `getStock`; it is not the item id.
   */
  async buy(shop: string, row: number, quantity = 1): Promise<boolean> {
    const html = await this.#client.fetchText("shop.php", {
      form: {
        whichshop: shop,
        action: "buyitem",
        whichrow: row,
        quantity,
      },
    });
    return Shop.parsePurchase(html);
  }

  static parsePurchase(html: string): boolean {
    return (
      /You acquire/i.test(html) &&
      !/don't have enough|not enough meat/i.test(html)
    );
  }

  static parse(html: string): ShopEntry[] {
    const stock: ShopEntry[] = [];

    for (const match of html.matchAll(ROW)) {
      const cells = match[2];

      // The name sits in the bold inside the item's own description link,
      // which is what tells it apart from the bold holding the price.
      const name = /descitem\(\d+\)['"]?>\s*<b>([^<]*)<\/b>/i.exec(cells)?.[1];
      // A purchase posts this, and nothing else identifies the offer.
      const row = /whichrow=(\d+)/.exec(cells)?.[1];
      if (!name || !row) continue;

      // How many the offer hands over, written after the name as "(11)".
      const quantity = /<\/b>(?:&nbsp;|\s)*<b>\((\d+)\)<\/b>/i.exec(cells)?.[1];

      // The currency is an image carrying its own name, and the price is the
      // next bold after it.
      const priced =
        /<img([^>]*\balt="([^"]+)"[^>]*)>[\s\S]*?<b>([\d,]+)<\/b>/i.exec(
          cells,
        ) ?? null;

      stock.push({
        row: Number(row),
        itemId: Number(match[1]),
        name: name.trim(),
        quantity: quantity ? Number(quantity) : 1,
        price: Number((priced?.[3] ?? "0").replace(/,/g, "")),
        currency: priced?.[2] ?? "",
        currencyDescId: priced
          ? Number(/descitem\((\d+)\)/.exec(priced[1])?.[1]) || null
          : null,
      });
    }

    return stock;
  }
}
