import { describe, expect, test } from "vitest";

import { loadFixture } from "../testUtils.js";
import { ApiStatusSchema } from "./ApiStatus.js";
import { Equipment } from "./Equipment.js";

describe("parseEntries", () => {
  test("parses main equipment slots with correct item IDs", async () => {
    const status = ApiStatusSchema.parse(
      JSON.parse(await loadFixture(__dirname, "status_with_effects.json")),
    );
    const entries = Equipment.parseEntries(status);
    expect(entries.find((e) => e.slot === "hat")).toMatchObject({
      slot: "hat",
      id: 9694,
    });
    expect(entries.find((e) => e.slot === "weapon")).toMatchObject({
      slot: "weapon",
      id: 10251,
    });
    expect(entries.find((e) => e.slot === "acc1")).toMatchObject({
      slot: "acc1",
      id: 8509,
    });
    expect(entries.find((e) => e.slot === "container")).toMatchObject({
      slot: "container",
      id: 6003,
    });
  });

  test("excludes empty slots (0 values)", async () => {
    const status = ApiStatusSchema.parse(
      JSON.parse(await loadFixture(__dirname, "status_with_effects.json")),
    );
    const entries = Equipment.parseEntries(status);
    const slots = entries.map((e) => e.slot);
    expect(slots).not.toContain("cardsleeve");
    expect(slots).not.toContain("sticker1");
    expect(slots).not.toContain("folder1");
  });

  test("returns empty array when equipment is absent", () => {
    const status = ApiStatusSchema.parse({
      playerid: "1",
      pwd: "abc",
      hardcore: "0",
      ascensions: "0",
      turnsplayed: "0",
      daynumber: "1",
      level: "1",
      roninleft: "0",
      path: "0",
      sign: "Mongoose",
      adventures: "0",
      class: "1",
      hp: "10",
      maxhp: 10,
      mp: "10",
      maxmp: 10,
      spleen: "10",
      full: "10",
      drunk: "10",
    });
    expect(Equipment.parseEntries(status)).toEqual([]);
  });
});
