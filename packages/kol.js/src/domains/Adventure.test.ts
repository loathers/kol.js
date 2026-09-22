import { describe, expect, test, vi } from "vitest";

import { Client } from "../Client.js";
import { loadFixture } from "../testUtils.js";
import {
  Adventure,
  extractChoiceOptions,
  extractEncounterName,
  parseAdventureBody,
  parseSpecialZone,
} from "./Adventure.js";

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

  test("currentEncounter says what the buttons offer, not just the id", async () => {
    const client = new Client("", "");
    vi.spyOn(client, "fetchText").mockResolvedValueOnce(
      await loadFixture(__dirname, "place_in_cage.html"),
    );
    const encounter = await client.adventure.currentEncounter();

    // Knowing it is choice 211 does not tell a caller that option 1 costs ten
    // adventures and option 2 is free.
    expect(encounter).toMatchObject({
      options: [
        { option: 1, label: "Gnaw through the bars (10 Adventures)" },
        { option: 2, label: "Wait for rescue" },
      ],
    });
  });

  test("reads the options off a real pending choice page", async () => {
    const body = await loadFixture(__dirname, "place_pending_choice.html");

    expect(extractChoiceOptions(body)).toEqual([
      { option: 1, label: "Head down the tunnel" },
      { option: 2, label: "Swim back toward the entrance" },
      { option: 3, label: "Open the grate" },
    ]);
  });
});

describe("extractChoiceOptions", () => {
  test("pairs each option with the text written on its button", () => {
    // The number alone says nothing about where the option leads.
    const body =
      `<form action=choice.php>` +
      `<input type=hidden name=option value=1>` +
      `<input type=submit value="Follow the stream">` +
      `</form>` +
      `<form action=choice.php>` +
      `<input type=hidden name=option value=2>` +
      `<input type=submit value="Take the road">` +
      `</form>`;

    expect(extractChoiceOptions(body)).toEqual([
      { option: 1, label: "Follow the stream" },
      { option: 2, label: "Take the road" },
    ]);
  });

  test("reads a link-shaped choice from its anchor text", () => {
    const body = `<a href="choice.php?whichchoice=123&option=3">Climb the tree</a>`;
    expect(extractChoiceOptions(body)).toEqual([
      { option: 3, label: "Climb the tree" },
    ]);
  });

  test("offers an option it could not name rather than dropping it", () => {
    const body = `<input type=hidden name=option value=9>`;
    expect(extractChoiceOptions(body)).toEqual([{ option: 9, label: "" }]);
  });

  test("decodes entities in a label", () => {
    const body =
      `<form><input type=hidden name=option value=1>` +
      `<input type=submit value="Bob&#039;s &amp; Sons"></form>`;
    expect(extractChoiceOptions(body)[0].label).toBe("Bob's & Sons");
  });

  test("expands a radio group into one option per choice", () => {
    // Submitting the bare option number is answered with "That's not a meal.
    // Pick a meal.", so each radio has to be offered with its own field.
    const body =
      `<form action=choice.php>` +
      `<input type=hidden name=option value=1>` +
      `<input type=radio name=whichmeal value=5 data-name="hot dog">` +
      `<input type=radio name=whichmeal value=6 data-name="pilsner">` +
      `<input type=submit value="Make and Eat!">` +
      `</form>`;

    expect(extractChoiceOptions(body)).toEqual([
      { option: 1, label: "Make and Eat!: hot dog", extra: { whichmeal: "5" } },
      { option: 1, label: "Make and Eat!: pilsner", extra: { whichmeal: "6" } },
    ]);
  });

  test("keeps plain options alongside expanded ones", () => {
    const body =
      `<form><input type=hidden name=option value=1>` +
      `<input type=radio name=meal value=5 data-name="a">` +
      `<input type=submit value="Eat"></form>` +
      `<form><input type=hidden name=option value=2>` +
      `<input type=submit value="Leave"></form>`;

    const options = extractChoiceOptions(body);
    expect(options.map((o) => o.option)).toEqual([1, 2]);
    expect(options[1]).toEqual({ option: 2, label: "Leave" });
  });

  test("finds nothing in a page that is not a choice", () => {
    expect(extractChoiceOptions("<html>an ordinary page</html>")).toEqual([]);
  });
});

describe("parseSpecialZone", () => {
  test.each([
    // The key names the page, not the parameter.
    ["place=bathole", "place.php", { whichplace: "bathole" }],
    ["crypt=cranny", "crypt.php", { action: "cranny" }],
    // The data records no value for the Knob; the throne room is the only part
    // of it reachable this way.
    ["cobbsknob=0", "cobbsknob.php", { action: "throneroom" }],
    // Everything else follows the obvious rule.
    ["cellar=1", "cellar.php", { cellar: "1" }],
    ["mining=1", "mining.php", { mining: "1" }],
    // "0" means the data records no value at all.
    ["tiles=0", "tiles.php", {}],
  ])("resolves %s", (url, path, query) => {
    expect(parseSpecialZone(url)).toEqual({ path, query });
  });
});

describe("Adventure requests", () => {
  function setup(response = "") {
    const client = new Client("", "");
    const fetchText = vi.spyOn(client, "fetchText").mockResolvedValue(response);
    return { adventure: new Adventure(client), fetchText };
  }

  test("adventureAt sends the parameter the page actually wants", async () => {
    const { adventure, fetchText } = setup("ok");
    await adventure.adventureAt("place=bathole");

    // Sending `place=bathole` fetches a valid page that is the wrong one, and
    // says nothing about it.
    expect(fetchText).toHaveBeenCalledWith("place.php", {
      method: "GET",
      query: { whichplace: "bathole" },
    });
  });

  test("a choice with extra fields is posted, not sent as a query", async () => {
    const { adventure, fetchText } = setup("ok");
    await adventure.choice(1234, 1, { whichmeal: "5" });

    expect(fetchText).toHaveBeenCalledWith("choice.php", {
      method: "POST",
      form: { whichchoice: 1234, option: 1, whichmeal: "5" },
    });
  });

  test("a plain choice still goes as a query", async () => {
    const { adventure, fetchText } = setup("ok");
    await adventure.choice(1234, 1);

    expect(fetchText).toHaveBeenCalledWith("choice.php", {
      query: { whichchoice: 1234, option: 1 },
    });
  });
});
