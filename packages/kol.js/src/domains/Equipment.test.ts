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
      rollover: "1778556599",
    });
    expect(Equipment.parseEntries(status)).toEqual([]);
  });
});

describe("folder slots", () => {
  const liveStatus = async () =>
    ApiStatusSchema.parse(
      JSON.parse(await loadFixture(__dirname, "api_status_live.json")),
    );

  test("keeps folder offsets apart from item ids", async () => {
    const entries = Equipment.parseEntries(await liveStatus());
    // api.php sends ["01","22","20","00","00"], zero-padded.
    expect(entries.filter((e) => e.kind === "folder")).toEqual([
      { slot: "folder1", id: 1, kind: "folder" },
      { slot: "folder2", id: 22, kind: "folder" },
      { slot: "folder3", id: 20, kind: "folder" },
    ]);
  });

  test("resolves offsets to the folders they name", async () => {
    const map = await Equipment.buildMap(await liveStatus());

    // Not item 1, the seal-clubbing club.
    expect(map.get("folder1")?.name).toBe("folder (red)");
    expect(map.get("folder1")?.id).toBe(6618);
    expect(map.get("folder2")?.name).toMatch(/^folder \(/);
    expect(map.get("folder3")?.name).toMatch(/^folder \(/);
    expect(map.has("folder4")).toBe(false);
  });

  test("still resolves ordinary slots by item id", async () => {
    const map = await Equipment.buildMap(await liveStatus());
    expect(map.get("container")?.id).toBe(11933);
    expect(map.get("cardsleeve")?.id).toBe(5003);
  });
});
