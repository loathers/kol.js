import type { Client } from "../Client.js";
import { Shop } from "./Shop.js";

export type FlowerPrices = {
  red: number;
  white: number;
  blue: number;
};

export class FloralMercantileExchangeParseError extends Error {
  constructor() {
    super("Could not parse flower prices");
    this.name = "FloralMercantileExchangeParseError";
  }
}

const SHOP = "flowertradein";

/**
 * Which tulip each row trades in, by the description id on its currency image.
 * The three are told apart by nothing else — every row is the same colour of
 * tulip image, and all three are simply named "tulip" in places.
 */
const TULIP_DESC_IDS: Record<keyof FlowerPrices, number> = {
  red: 973996072,
  white: 156741343,
  blue: 126513532,
};

export class FloralMercantileExchange {
  #client: Client;

  constructor(client: Client) {
    this.#client = client;
  }

  async getPrices(): Promise<FlowerPrices> {
    const page = await this.#client.fetchText(`shop.php?whichshop=${SHOP}`);

    const result = FloralMercantileExchange.parse(page);
    if (!result) throw new FloralMercantileExchangeParseError();
    return result;
  }

  /**
   * What each tulip trades for, in Chroner.
   *
   * These rows are trade-ins rather than purchases: the row's item is Chroner,
   * the "price" is one tulip, and the quantity is what you get back.
   */
  static parse(page: string): FlowerPrices | null {
    const byDescId = new Map(
      Shop.parse(page).map((entry) => [entry.currencyDescId, entry.quantity]),
    );

    const prices = {
      red: byDescId.get(TULIP_DESC_IDS.red),
      white: byDescId.get(TULIP_DESC_IDS.white),
      blue: byDescId.get(TULIP_DESC_IDS.blue),
    };

    if (Object.values(prices).some((price) => price === undefined)) return null;
    return prices as FlowerPrices;
  }
}
