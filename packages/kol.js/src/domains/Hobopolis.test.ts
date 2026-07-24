import { describe, expect, test } from "vitest";

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
