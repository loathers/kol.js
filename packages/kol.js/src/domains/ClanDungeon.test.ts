import { describe, expect, test, vi } from "vitest";

import { Client } from "../Client.js";
import { loadFixture } from "../testUtils.js";
import { ClanDungeon } from "./ClanDungeon.js";

describe("closeDungeon", () => {
  const client = new Client("", "");
  const dungeon = new ClanDungeon(client);

  test("fails when the dungeon has undistributed loot", async () => {
    vi.spyOn(client, "fetchText").mockResolvedValueOnce(
      await loadFixture(__dirname, "clan_basement_close_loot_blocked.html"),
    );
    expect(await dungeon.closeDungeon("hobopolis")).toEqual({
      success: false,
      reason: "Dungeon has undistributed loot",
    });
  });

  test("fails when the dungeon's close form is still shown", async () => {
    vi.spyOn(client, "fetchText").mockResolvedValueOnce(
      await loadFixture(__dirname, "clan_basement_dungeons_open.html"),
    );
    expect(await dungeon.closeDungeon("dreadsylvania")).toEqual({
      success: false,
      reason: "Dungeon is still open",
    });
  });

  test("succeeds when the sewers flood", async () => {
    vi.spyOn(client, "fetchText").mockResolvedValueOnce(
      await loadFixture(
        __dirname,
        "clan_basement_close_hobopolis_success.html",
      ),
    );
    expect(await dungeon.closeDungeon("hobopolis")).toEqual({ success: true });
  });
});

describe("openDungeon", () => {
  const client = new Client("", "");
  const dungeon = new ClanDungeon(client);

  test("succeeds when the close form appears", async () => {
    vi.spyOn(client, "fetchText").mockResolvedValueOnce(
      await loadFixture(__dirname, "clan_basement_open_hobopolis_success.html"),
    );
    expect(await dungeon.openDungeon("hobopolis")).toEqual({ success: true });
  });

  test("fails when the dungeon stays closed", async () => {
    vi.spyOn(client, "fetchText").mockResolvedValueOnce(
      await loadFixture(
        __dirname,
        "clan_basement_close_hobopolis_success.html",
      ),
    );
    expect(await dungeon.openDungeon("hobopolis")).toEqual({
      success: false,
      reason: "Dungeon did not open",
    });
  });
});
