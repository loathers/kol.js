import type { AscensionClass } from "data-of-loathing";
import { describe, expect, test, vi } from "vitest";

import { Client } from "../Client.js";
import { loadFixture } from "../testUtils.js";
import { Gender, Lifestyle, MoonSign, Valhalla } from "./Valhalla.js";

const fixture = (name: string) =>
  loadFixture(__dirname, `valhalla_${name}.html`);

describe("parseInValhalla", () => {
  test("detects a spirit's charpane", async () => {
    expect(Valhalla.parseInValhalla(await fixture("charpane"))).toBe(true);
  });

  test("accepts the second marker KoLmafia knows about", () => {
    expect(Valhalla.parseInValhalla("x<br>Lvl. <img src=y>")).toBe(true);
  });

  test("rejects an ordinary charpane", () => {
    expect(Valhalla.parseInValhalla("<html>ordinary charpane</html>")).toBe(
      false,
    );
  });
});

describe("parsePasswordHash", () => {
  test("reads the hash charpane declares", async () => {
    expect(Valhalla.parsePasswordHash(await fixture("charpane"))).toMatch(
      /^[0-9a-f]{32}$/,
    );
  });

  test.each(["afterlife", "reincarnate"])("%s carries none", async (name) => {
    expect(Valhalla.parsePasswordHash(await fixture(name))).toBeNull();
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
  test("reads the ids the ascension POST needs", async () => {
    const options = Valhalla.parseReincarnationOptions(
      await fixture("reincarnate"),
    );

    expect(options.lifestyles).toEqual([1, 2, 3]);
    expect(options.classes).toEqual([1, 2, 3, 4, 5, 6]);
    expect(options.genders).toEqual([1, 2]);
    expect(options.signs).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
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

  // validate exists to catch values the types already forbid, so the overrides
  // come in loosely typed.
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
    // What one live run produced; another gets a different subset.
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
