import { describe, expect, test } from "vitest";

import { loadFixture } from "../testUtils.js";
import { ApiStatusSchema } from "./ApiStatus.js";
import { Effects } from "./Effects.js";

describe("parseEntries", () => {
  test("parses effect ids and durations", async () => {
    const status = ApiStatusSchema.parse(
      JSON.parse(await loadFixture(__dirname, "status_with_effects.json")),
    );
    const entries = Effects.parseEntries(status);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.find((e) => e.id === 2456)).toMatchObject({
      id: 2456,
      duration: 3,
    });
    expect(entries.find((e) => e.id === 50)).toMatchObject({
      id: 50,
      duration: 3,
    });
    expect(entries.find((e) => e.id === 2109)).toMatchObject({
      id: 2109,
      duration: 135600,
    });
  });

  test("parses intrinsics as Infinity duration", async () => {
    const status = ApiStatusSchema.parse(
      JSON.parse(await loadFixture(__dirname, "status_with_effects.json")),
    );
    const entries = Effects.parseEntries(status);
    expect(entries.find((e) => e.id === 168)).toMatchObject({
      id: 168,
      duration: Infinity,
    });
    expect(entries.find((e) => e.id === 2694)).toMatchObject({
      id: 2694,
      duration: Infinity,
    });
  });

  test("returns empty array when effects and intrinsics are absent", () => {
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
    });
    expect(Effects.parseEntries(status)).toEqual([]);
  });
});
