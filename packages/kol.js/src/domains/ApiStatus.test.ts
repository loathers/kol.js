import * as path from "node:path";
import { describe, expect, it } from "vitest";

import { loadFixture } from "../testUtils.js";
import { ApiStatusSchema } from "./ApiStatus.js";
import { Effects } from "./Effects.js";
import { MoonSign } from "./MoonSign.js";

const minimalStatus = (overrides: Record<string, unknown> = {}) => ({
  playerid: "1",
  pwd: "abc",
  hardcore: "0",
  ascensions: "0",
  turnsplayed: "0",
  daynumber: "1",
  level: "1",
  roninleft: "0",
  path: "0",
  sign: "None",
  adventures: "40",
  class: "0",
  hp: "10",
  maxhp: 10,
  mp: "10",
  maxmp: 10,
  spleen: "10",
  full: "10",
  drunk: "10",
  effects: [],
  intrinsics: [],
  rollover: "1778556599",
  ...overrides,
});

describe("ApiStatusSchema", () => {
  it("parses a real status where intrinsics is an empty array", async () => {
    // KoL serialises an empty PHP associative array as `[]`, not `{}`. A real
    // account with no intrinsics returns `"intrinsics": []`, which must coerce
    // to an empty record rather than throwing `expected record, received array`.
    const raw = JSON.parse(
      await loadFixture(
        path.join(__dirname, "../integration"),
        "api_status.json",
      ),
    ) as Record<string, unknown>;
    expect(raw.intrinsics).toEqual([]);

    const status = ApiStatusSchema.parse(raw);

    expect(status.intrinsics).toEqual({});
    expect(status.effects).toMatchObject({});
  });

  it("treats empty-array effects and intrinsics as empty records", () => {
    const status = ApiStatusSchema.parse(minimalStatus());

    expect(status.effects).toEqual({});
    expect(status.intrinsics).toEqual({});
    expect(status.rollover).toBe(1778556599);
  });

  // A null used to throw, taking out every fetchStatus() caller.
  it.each([null, ""])("accepts %j in an effect's unused slot", (slot) => {
    const status = ApiStatusSchema.parse(
      minimalStatus({
        effects: {
          acf143c704afaf7504ac07375084f79e: [
            "Beaten Up",
            "3",
            "beatenup",
            slot,
            "7",
          ],
        },
      }),
    );

    expect(status.effects.acf143c704afaf7504ac07375084f79e).toEqual([
      "Beaten Up",
      3,
      "beatenup",
      "",
      7,
    ]);
    expect(Effects.parseEntries(status)).toEqual([{ id: 7, duration: 3 }]);
  });

  it.each([
    ["Mongoose", MoonSign.Mongoose],
    ["Bad Moon", MoonSign.BadMoon],
    ["None", null],
  ])("resolves the sign %j", (sign, expected) => {
    expect(ApiStatusSchema.parse(minimalStatus({ sign })).sign).toBe(expected);
  });

  it("accepts a null intrinsic slot too", () => {
    const status = ApiStatusSchema.parse(
      minimalStatus({
        intrinsics: {
          d1f2: ["Chronic Indigestion", null, "sickface", "1758"],
        },
      }),
    );

    expect(status.intrinsics.d1f2).toEqual([
      "Chronic Indigestion",
      "",
      "sickface",
      1758,
    ]);
  });

  describe("against a live capture", () => {
    const liveStatus = async () =>
      JSON.parse(
        await loadFixture(__dirname, "api_status_live.json"),
      ) as Record<string, unknown>;

    it("keeps the in-run counters, which daynumber cannot stand in for", async () => {
      const status = ApiStatusSchema.parse(await liveStatus());
      expect(status.daysthisrun).toBe(1);
      expect(status.turnsthisrun).toBe(40);
      // The global clock is a different number entirely, and does not move
      // within a run.
      expect(status.daynumber).toBe(8624);
    });

    it("keeps the base substats that zone entry gates on", async () => {
      const status = ApiStatusSchema.parse(await liveStatus());
      expect(status.basemuscle).toBe(10000);
      expect(status.basemysticality).toBe(7071);
      expect(status.basemoxie).toBe(7071);
    });

    it("keeps the familiar's weight", async () => {
      const status = ApiStatusSchema.parse(await liveStatus());
      expect(status.famlevel).toBe(1);
    });

    it("reads folder_holder as the zero-padded offsets KoL sends", async () => {
      const status = ApiStatusSchema.parse(await liveStatus());
      expect(status.folder_holder).toEqual([1, 22, 20, 0, 0]);
    });
  });
});
