import { describe, expect, test, vi } from "vitest";

import { Client } from "../Client.js";
import { loadFixture } from "../testUtils.js";
import { extractEncounterName, parseAdventureBody } from "./Adventure.js";

describe("extractEncounterName", () => {
  test("centered encounter title", () => {
    expect(
      extractEncounterName(`<center><b>Disgustin' Junction</b></center>`),
    ).toBe("Disgustin' Junction");
  });

  test("bold title followed by a paragraph", () => {
    expect(
      extractEncounterName(`<b>Some Encounter</b><p>You see things.`),
    ).toBe("Some Encounter");
  });

  test("plain text has no name", () => {
    expect(extractEncounterName(`You shouldn't be here.`)).toBe("");
  });
});

describe("parseAdventureBody", () => {
  test("choice with unquoted attributes, as KoL really emits them", () => {
    const body = `<center><b>Despite All Your Rage</b></center><form action=choice.php><input type=hidden name=whichchoice value=211></form>`;

    expect(parseAdventureBody(body)).toEqual({
      kind: "choice",
      id: 211,
      name: "Despite All Your Rage",
    });
  });

  test("choice with quoted attributes", () => {
    const body = `<center><b>A Choice</b></center><input type="hidden" name="whichchoice" value="1023">`;

    expect(parseAdventureBody(body)).toEqual({
      kind: "choice",
      id: 1023,
      name: "A Choice",
    });
  });

  test("choice detected from a choice.php link", () => {
    const body = `<a href="choice.php?whichchoice=198&option=3">Open it</a>`;

    expect(parseAdventureBody(body)).toEqual({
      kind: "choice",
      id: 198,
      name: "",
    });
  });

  test.each(["fightform", "id='monpic'", "combat.gif"])(
    "combat detected via %s",
    (marker) => {
      expect(parseAdventureBody(`<html>${marker}</html>`)).toEqual({
        kind: "combat",
      });
    },
  );

  test("noncombat with a name", () => {
    expect(
      parseAdventureBody(`<center><b>A Quiet Moment</b></center>`),
    ).toEqual({
      kind: "noncombat",
      name: "A Quiet Moment",
    });
  });

  test.each([
    "You don't have enough Adventures left",
    "You're out of adventures.",
  ])("out of adventures: %s", (message) => {
    expect(parseAdventureBody(message)).toEqual({ kind: "none" });
  });
});

describe("real fixtures", () => {
  test("an idle place.php page is not an encounter", async () => {
    const body = await loadFixture(__dirname, "place_idle.html");
    expect(parseAdventureBody(body).kind).toBe("noncombat");
  });

  test("currentEncounter is null on an idle page", async () => {
    const client = new Client("", "");
    vi.spyOn(client, "fetchText").mockResolvedValueOnce(
      await loadFixture(__dirname, "place_idle.html"),
    );
    expect(await client.adventure.currentEncounter()).toBeNull();
  });

  test("a pending choice shown by place.php uses the blue page header", async () => {
    const body = await loadFixture(__dirname, "place_pending_choice.html");
    expect(extractEncounterName(body)).toBe("Disgustin' Junction");
    expect(parseAdventureBody(body)).toEqual({
      kind: "choice",
      id: 198,
      name: "Disgustin' Junction",
    });
  });

  test("currentEncounter reports the pending cage choice", async () => {
    const client = new Client("", "");
    vi.spyOn(client, "fetchText").mockResolvedValueOnce(
      await loadFixture(__dirname, "place_in_cage.html"),
    );
    const encounter = await client.adventure.currentEncounter();
    expect(encounter).toMatchObject({
      type: "choice",
      id: 211,
      name: "Despite All Your Rage",
    });
  });
});
