import type { AscensionClass } from "data-of-loathing";
import { describe, expect, test, vi } from "vitest";

import { Client } from "../Client.js";
import { loadFixture } from "../testUtils.js";
import {
  parseInValhalla,
  parsePasswordHash,
  parsePlayerId,
} from "../utils/charpane.js";
import { Gender } from "./Gender.js";
import { Lifestyle } from "./Lifestyle.js";
import { MoonSign } from "./MoonSign.js";
import { Valhalla } from "./Valhalla.js";

const fixture = (name: string) =>
  loadFixture(__dirname, `valhalla_${name}.html`);

describe("parseInValhalla", () => {
  test("detects a spirit's charpane", async () => {
    expect(parseInValhalla(await fixture("charpane"))).toBe(true);
  });

  test("accepts a charpane that only shows the level image", () => {
    expect(parseInValhalla("x<br>Lvl. <img src=y>")).toBe(true);
  });

  test("rejects an ordinary charpane", () => {
    expect(parseInValhalla("<html>ordinary charpane</html>")).toBe(false);
  });
});

describe("parsePasswordHash", () => {
  test("reads the hash charpane declares", async () => {
    expect(parsePasswordHash(await fixture("charpane"))).toMatch(
      /^[0-9a-f]{32}$/,
    );
  });

  test.each(["afterlife", "reincarnate"])("%s carries none", async (name) => {
    expect(parsePasswordHash(await fixture(name))).toBeNull();
  });
});

describe("parsePlayerId", () => {
  test("reads the id charpane declares", async () => {
    expect(parsePlayerId(await fixture("charpane"))).toBe("24");
  });

  test.each(["afterlife", "reincarnate"])("%s carries none", async (name) => {
    expect(parsePlayerId(await fixture(name))).toBeNull();
  });
});

describe("parseKarma", () => {
  test("reads the Pearly Gates reward", async () => {
    expect(Valhalla.parseKarma(await fixture("pearlygates"))).toBe(11);
  });

  test("handles a thousands separator", () => {
    expect(Valhalla.parseKarma("You gain 1,234 Karma")).toBe(1234);
  });

  test("is null when no karma was awarded", async () => {
    expect(Valhalla.parseKarma(await fixture("afterlife"))).toBeNull();
  });
});

describe("parseReincarnationOptions", () => {
  test("names what the form offers, leaving classes as ids", async () => {
    const options = Valhalla.parseReincarnationOptions(
      await fixture("reincarnate"),
    );

    expect(options.lifestyles).toEqual(Object.values(Lifestyle));
    expect(options.genders).toEqual(Object.values(Gender));
    expect(options.signs).toEqual(Object.values(MoonSign));
    expect(options.classes).toEqual([1, 2, 3, 4, 5, 6]);
  });

  test("reads every path radio, including unrestricted", async () => {
    const { paths, defaultPath } = Valhalla.parseReincarnationOptions(
      await fixture("reincarnate"),
    );

    expect(paths).toHaveLength(56);
    expect(paths).toContain(0);
    expect(paths).toContain(22);
    expect(defaultPath).toBe(22);
  });

  test("is empty rather than throwing on a page with no form", () => {
    expect(Valhalla.parseReincarnationOptions("<html>nope</html>")).toEqual({
      lifestyles: [],
      classes: [],
      genders: [],
      signs: [],
      paths: [],
      defaultPath: null,
    });
  });
});

describe("validate", () => {
  const choice = {
    lifestyle: Lifestyle.Hardcore,
    class: 1,
    gender: Gender.Male,
    sign: MoonSign.Mongoose,
    path: 22,
  };

  // validate catches what the types forbid, so overrides come in loose.
  const validateWith = (override: Record<string, number>) =>
    Valhalla.validate({ ...choice, ...override });

  test("accepts a workable choice", () => {
    expect(Valhalla.validate(choice)).toBeNull();
  });

  test.each([
    ["lifestyle", { lifestyle: 9 }, /invalid lifestyle/],
    ["class", { class: 0 }, /invalid class/],
    ["gender", { gender: 7 }, /invalid gender/],
    ["sign", { sign: 42 }, /invalid moon sign/],
    ["path", { path: -1 }, /invalid path/],
  ])("rejects a bad %s", (_, override, message) => {
    expect(validateWith(override)).toMatch(message);
  });

  test("rejects Bad Moon on a restricted path", () => {
    expect(Valhalla.validate({ ...choice, sign: MoonSign.BadMoon })).toMatch(
      /Bad Moon/,
    );
  });

  test("allows Bad Moon with no path", () => {
    expect(
      Valhalla.validate({ ...choice, sign: MoonSign.BadMoon, path: 0 }),
    ).toBeNull();
  });
});

describe("parseAscendConfirmation", () => {
  test("echoes back the exact second POST the game wants", async () => {
    const confirmation = Valhalla.parseAscendConfirmation(
      await fixture("confirm"),
    );

    expect(confirmation?.fields).toEqual({
      action: "ascend",
      confirmascend: "1",
      whichsign: "1",
      gender: "1",
      whichclass: "1",
      whichpath: "22",
      asctype: "3",
    });
  });

  test("picks up the conditional acknowledgements", async () => {
    // What one live run produced. Another gets a different subset.
    const confirmation = Valhalla.parseAscendConfirmation(
      await fixture("confirm"),
    );

    expect(confirmation?.acknowledgements).toEqual({
      lamepathok: "1",
      nopetok: "1",
      noskillsok: "1",
    });
  });

  test("summarises what is about to happen", async () => {
    const confirmation = Valhalla.parseAscendConfirmation(
      await fixture("confirm"),
    );

    expect(confirmation?.summary).toMatch(/Hardcore/);
    expect(confirmation?.summary).toMatch(/Seal Clubber/);
    expect(confirmation?.summary).toMatch(/Standard.* Path\./);
  });

  test.each(["reincarnate", "afterlife"])(
    "%s is not a confirmation",
    async (name) => {
      expect(Valhalla.parseAscendConfirmation(await fixture(name))).toBeNull();
    },
  );
});

describe("parseAscendResult", () => {
  test("being handed the form back is a failure", async () => {
    expect(
      Valhalla.parseAscendResult(await fixture("reincarnate")),
    ).toStrictEqual({
      success: false,
      reason: "still on the reincarnation form",
    });
  });

  test("still being in Valhalla is a failure", async () => {
    expect(
      Valhalla.parseAscendResult(await fixture("afterlife")),
    ).toStrictEqual({ success: false, reason: "still in Valhalla" });
  });

  test("landing back in the Kingdom is a success", () => {
    expect(
      Valhalla.parseAscendResult("<html>Welcome back to the Kingdom</html>"),
    ).toStrictEqual({ success: true });
  });

  test("a page we cannot place is not taken for a success", () => {
    expect(
      Valhalla.parseAscendResult("<html>You can't do that right now.</html>"),
    ).toStrictEqual({
      success: false,
      reason: "unrecognised response to the confirmation",
    });
  });
});

describe("ascend", () => {
  const choice = {
    lifestyle: Lifestyle.Hardcore,
    class: 1,
    gender: Gender.Male,
    sign: MoonSign.Mongoose,
    path: 22,
  };

  const clientPosting = (...replies: string[]) => {
    const forms: unknown[] = [];
    const client = new Client("", "");
    vi.spyOn(client, "fetchText").mockImplementation((_path, options) => {
      forms.push(options?.form);
      return Promise.resolve(replies[forms.length - 1] ?? "");
    });
    return { valhalla: new Valhalla(client), forms };
  };

  test("posts the choice, then the confirmation the game asked for", async () => {
    const { valhalla, forms } = clientPosting(
      await fixture("confirm"),
      "<html>Welcome back to the Kingdom</html>",
    );

    expect(await valhalla.ascend(choice)).toStrictEqual({ success: true });

    expect(forms[0]).toEqual({
      action: "ascend",
      asctype: 3,
      whichclass: 1,
      gender: 1,
      whichsign: 1,
      whichpath: 22,
    });
    expect(forms[1]).toEqual({
      action: "ascend",
      confirmascend: "1",
      whichsign: "1",
      gender: "1",
      whichclass: "1",
      whichpath: "22",
      asctype: "3",
      lamepathok: "1",
      nopetok: "1",
      noskillsok: "1",
    });
  });

  test("takes a class entity as readily as an id", async () => {
    const { valhalla, forms } = clientPosting(await fixture("confirm"), "");
    const sauceror = { id: 4, name: "Sauceror" } as AscensionClass;

    await valhalla.ascend({ ...choice, class: sauceror });

    expect(forms[0]).toMatchObject({ whichclass: 4 });
  });

  test("does not commit when the game offers no confirmation", async () => {
    const { valhalla, forms } = clientPosting(await fixture("reincarnate"));

    expect(await valhalla.ascend(choice)).toStrictEqual({
      success: false,
      reason: "the game offered no confirmation",
    });
    expect(forms).toHaveLength(1);
  });

  test("reports a confirmation that did not take", async () => {
    const { valhalla } = clientPosting(
      await fixture("confirm"),
      await fixture("reincarnate"),
    );

    expect(await valhalla.ascend(choice)).toStrictEqual({
      success: false,
      reason: "still on the reincarnation form",
    });
  });

  test("refuses a choice the game would not accept, without posting", async () => {
    const { valhalla, forms } = clientPosting();

    await expect(
      valhalla.ascend({ ...choice, sign: MoonSign.BadMoon }),
    ).rejects.toThrow(/Bad Moon/);
    expect(forms).toHaveLength(0);
  });
});

describe("Karma vendors", () => {
  const clientGetting = (reply: string) => {
    const queries: unknown[] = [];
    const client = new Client("", "");
    const fetchText = vi
      .spyOn(client, "fetchText")
      .mockImplementation((_path, options) => {
        queries.push(options?.query);
        return Promise.resolve(reply);
      });
    return { valhalla: new Valhalla(client), queries, fetchText };
  };

  test("reads what the Deli Lama is selling", async () => {
    expect(Valhalla.parseAstralOffers(await fixture("deli"))).toEqual([
      { descId: 725022566, name: "astral hot dog dinner", item: 5045 },
      { descId: 507110915, name: "astral six-pack", item: 5046 },
      {
        descId: 824102367,
        name: "carton of astral energy drinks",
        item: 10882,
      },
    ]);
  });

  test("reads the armory's whole shelf", async () => {
    const offers = Valhalla.parseAstralOffers(await fixture("armory"));

    expect(offers).toHaveLength(13);
    expect(offers[0]).toEqual({
      descId: 864672857,
      name: "astral bludgeon",
      item: 5028,
    });
    expect(offers.at(-1)).toEqual({
      descId: 645097274,
      name: "astral belt",
      item: 5042,
    });
  });

  test("does not take a row's image for a second offer", async () => {
    const deli = await fixture("deli");
    expect(deli).toMatch(/descitem/);
    expect(Valhalla.parseAstralOffers(deli)).toHaveLength(3);
  });

  test("finds nothing on a page that sells nothing", async () => {
    expect(Valhalla.parseAstralOffers(await fixture("reincarnate"))).toEqual(
      [],
    );
    expect(Valhalla.parseAstralOffers("<html>nothing here</html>")).toEqual([]);
  });

  test("buys with the action belonging to that vendor", async () => {
    const { valhalla, queries } = clientGetting("You acquire an item: hot dog");

    expect(await valhalla.buyAstral("deli", 5045)).toStrictEqual({
      success: true,
    });
    expect(queries[0]).toEqual({ action: "buydeli", whichitem: 5045 });
  });

  test("takes an offer in place of a bare id", async () => {
    const { valhalla, queries } = clientGetting("You acquire an item: shield");
    const [offer] = Valhalla.parseAstralOffers(await fixture("armory"));

    await valhalla.buyAstral("armory", offer);
    expect(queries[0]).toEqual({ action: "buyarmory", whichitem: 5028 });
  });

  test("refuses a place that does not sell for Karma", async () => {
    const { valhalla, fetchText } = clientGetting("");
    await expect(valhalla.buyAstral("reincarnate", 5045)).rejects.toThrow(
      /not a Karma vendor/,
    );
    expect(fetchText).not.toHaveBeenCalled();
  });

  test("reports running out of Karma rather than claiming success", () => {
    expect(
      Valhalla.parseAstralPurchase("You don't have enough Karma for that."),
    ).toStrictEqual({ success: false, reason: "not enough Karma" });
  });

  test("does not take a page it cannot place for a purchase", () => {
    expect(
      Valhalla.parseAstralPurchase("<html>who knows</html>"),
    ).toStrictEqual({
      success: false,
      reason: "unrecognised response to the purchase",
    });
  });
});
