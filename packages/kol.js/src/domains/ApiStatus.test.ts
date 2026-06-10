import * as path from "node:path";
import { describe, expect, it } from "vitest";

import { loadFixture } from "../testUtils.js";
import { ApiStatusSchema } from "./ApiStatus.js";

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
      sign: "None",
      adventures: "40",
      class: "0",
      hp: "10",
      maxhp: 10,
      mp: "10",
      maxmp: 10,
      effects: [],
      intrinsics: [],
    });

    expect(status.effects).toEqual({});
    expect(status.intrinsics).toEqual({});
  });
});
