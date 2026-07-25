import { describe, expect, test, vi } from "vitest";

import { Client } from "../Client.js";
import { loadFixture } from "../testUtils.js";
import { HobopolisDungeon } from "./Hobopolis.js";

describe("parseSewerEncounter", () => {
  test("cage with choice 211", () => {
    const body = `<center><b>Despite All Your Rage</b></center><form action=choice.php><input type=hidden name=whichchoice value=211><input class=button type=submit value=211></form> value=211>`;
    expect(HobopolisDungeon.parseSewerEncounter(body)).toEqual({
      type: "cage",
      whichchoice: 211,
    });
  });

  test("cage with choice 212", () => {
    const body = `<center><b>Despite All Your Rage</b></center><input type=hidden name=whichchoice value=212>`;
    expect(HobopolisDungeon.parseSewerEncounter(body)).toEqual({
      type: "cage",
      whichchoice: 212,
    });
  });

  test("grate", () => {
    expect(
      HobopolisDungeon.parseSewerEncounter(
        `<center><b>Disgustin' Junction</b></center>`,
      ),
    ).toEqual({ type: "junction" });
  });

  test("valve", () => {
    expect(
      HobopolisDungeon.parseSewerEncounter(
        `<center><b>Somewhat Higher and Mostly Dry</b></center>`,
      ),
    ).toEqual({ type: "higherAndDry" });
  });

  test("cage from the outside", () => {
    expect(
      HobopolisDungeon.parseSewerEncounter(
        `<center><b>The Former or the Ladder</b></center>`,
      ),
    ).toEqual({ type: "ladder" });
  });

  test("gnawed-through cage", () => {
    expect(
      HobopolisDungeon.parseSewerEncounter(
        `<center><b>Pop!</b></center><input type=hidden name=whichchoice value=296>`,
      ),
    ).toEqual({
      type: "gnawedCage",
    });
  });

  test("hodgman defeated", () => {
    expect(
      HobopolisDungeon.parseSewerEncounter(`You shouldn't be here.`),
    ).toEqual({
      type: "hodgmanDefeated",
    });
  });

  test("passed through", () => {
    expect(
      HobopolisDungeon.parseSewerEncounter(
        `You've already found your way through these sewers, and you don't feel like spending any more time down there than you absolutely have to.`,
      ),
    ).toEqual({ type: "passedThrough" });
  });

  test("combat falls through to other", () => {
    expect(
      HobopolisDungeon.parseSewerEncounter(`<img id='monpic' src="hobo.gif">`),
    ).toEqual({ type: "other" });
  });
});

describe("parseSewerProgress", () => {
  test("empty log", () => {
    expect(HobopolisDungeon.parseSewerProgress("")).toEqual({
      grates: 0,
      valves: 0,
    });
  });

  test("single entries", () => {
    const log = [
      `Player (#1) opened a sewer grate (1 turn)`,
      `Player (#1) lowered the water level (1 turn)`,
    ].join("<br>");

    expect(HobopolisDungeon.parseSewerProgress(log)).toEqual({
      grates: 1,
      valves: 1,
    });
  });

  test("multiple entries accumulate", () => {
    const log = [
      `Player (#1) opened 3 sewer grates 3 times (3 turns)`,
      `Other (#2) opened a sewer grate (1 turn)`,
      `Player (#1) lowered the water level 5 times (5 turns)`,
      `Other (#2) lowered the water level (1 turn)`,
    ].join("<br>");

    expect(HobopolisDungeon.parseSewerProgress(log)).toEqual({
      grates: 4,
      valves: 6,
    });
  });
});

describe("real fixtures", () => {
  test("hodgman-defeated page", async () => {
    const html = await loadFixture(__dirname, "sewer_hodgman_defeated.html");
    expect(HobopolisDungeon.parseSewerEncounter(html)).toEqual({
      type: "hodgmanDefeated",
    });
  });

  test.each([
    ["sewer_cage.html", { type: "cage", whichchoice: 211 }],
    ["sewer_junction.html", { type: "junction" }],
    ["sewer_higher_and_dry.html", { type: "higherAndDry" }],
    ["sewer_ladder.html", { type: "ladder" }],
    ["sewer_passed_through.html", { type: "passedThrough" }],
  ])("classifies %s", async (fixture, expected) => {
    const html = await loadFixture(__dirname, fixture);
    expect(HobopolisDungeon.parseSewerEncounter(html)).toEqual(expected);
  });

  test("isCaged is true when place.php shows the cage choice", async () => {
    const client = new Client("", "");
    const dungeon = new HobopolisDungeon(client);
    vi.spyOn(client, "fetchText").mockResolvedValueOnce(
      await loadFixture(__dirname, "place_in_cage.html"),
    );
    expect(await dungeon.isCaged()).toBe(true);
  });

  test("isCaged is false in an ordinary pending choice", async () => {
    const client = new Client("", "");
    const dungeon = new HobopolisDungeon(client);
    vi.spyOn(client, "fetchText").mockResolvedValueOnce(
      await loadFixture(__dirname, "place_pending_choice.html"),
    );
    expect(await dungeon.isCaged()).toBe(false);
  });

  test("the valve result contains the twistValve success text", async () => {
    const html = await loadFixture(__dirname, "sewer_valve_result.html");
    expect(
      /as the water level in the sewer lowers by a couple of inches/i.test(
        html,
      ),
    ).toBe(true);
  });
});
