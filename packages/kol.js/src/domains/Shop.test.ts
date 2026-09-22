import { describe, expect, it, vi } from "vitest";

import { Client } from "../Client.js";
import { gameData } from "../GameData.js";
import { loadFixture } from "../testUtils.js";
import { Shop } from "./Shop.js";

const generalStore = () => loadFixture(__dirname, "shop_generalstore.html");

describe("parse", () => {
  it("reads every offer the page lists", async () => {
    expect(Shop.parse(await generalStore())).toHaveLength(21);
  });

  it("keeps the row and the item id apart", async () => {
    const stock = Shop.parse(await generalStore());
    const balm = stock.find((entry) => entry.itemId === 2595);

    // The two numbers are unrelated, and buying posts the row.
    expect(balm).toMatchObject({
      itemId: 2595,
      row: 630,
      price: 24,
      quantity: 1,
    });
  });

  it("leaves entities in names intact, because the item tables do too", async () => {
    const stock = Shop.parse(await generalStore());
    const balm = stock.find((entry) => entry.itemId === 2595);

    expect(balm!.name).toBe("Ben-Gal&trade; Balm");
    // Decoding it would stop this lookup working.
    await expect(gameData.findItemByName(balm!.name)).resolves.toMatchObject({
      id: 2595,
    });
  });

  it("records what the price is in", async () => {
    const stock = Shop.parse(await generalStore());
    expect(stock.every((entry) => entry.currency === "Meat")).toBe(true);
  });

  it("yields nothing for a page with no stock", () => {
    expect(Shop.parse("<html>nothing here</html>")).toEqual([]);
  });

  it("reads a trade-in row, where the currency is an item", async () => {
    // The Floral Mercantile Exchange pays Chroner for tulips, so the row means
    // "hand over 1 red tulip, receive 11 Chroner".
    const stock = Shop.parse(await loadFixture(__dirname, "flowers.html"));
    const red = stock.find((entry) => entry.currencyDescId === 973996072);

    expect(red).toMatchObject({
      name: "Chroner",
      quantity: 11,
      price: 1,
      currency: "red tulip",
    });
  });
});

describe("parsePurchase", () => {
  it("treats an acquisition as success", () => {
    expect(Shop.parsePurchase("You acquire an item: <b>a thing</b>")).toBe(
      true,
    );
  });

  it.each([
    "You don't have enough Meat",
    "not enough meat, sorry",
    "nothing happened at all",
  ])("treats %j as failure", (body) => {
    expect(Shop.parsePurchase(body)).toBe(false);
  });
});

describe("requests", () => {
  function setup(response = "") {
    const client = new Client("", "");
    const fetchText = vi.spyOn(client, "fetchText").mockResolvedValue(response);
    return { shop: new Shop(client), fetchText };
  }

  it("asks for the named shop", async () => {
    const { shop, fetchText } = setup(await generalStore());
    await shop.getStock("generalstore");

    expect(fetchText).toHaveBeenCalledWith("shop.php", {
      method: "GET",
      query: { whichshop: "generalstore" },
    });
  });

  it("buys by row, posting the fields the page's own button carries", async () => {
    const { shop, fetchText } = setup("You acquire an item: <b>a thing</b>");

    await expect(shop.buy("generalstore", 630, 3)).resolves.toBe(true);
    expect(fetchText).toHaveBeenCalledWith("shop.php", {
      form: {
        whichshop: "generalstore",
        action: "buyitem",
        whichrow: 630,
        quantity: 3,
      },
    });
  });
});
