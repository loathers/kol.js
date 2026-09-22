import { describe, expect, it, vi } from "vitest";

import { Client } from "../Client.js";
import { loadFixture } from "../testUtils.js";
import { QuestLog, questLogText } from "./QuestLog.js";

const fixture = (name: string) => loadFixture(__dirname, `${name}.html`);

describe("questLogText", () => {
  it("does not leave a gap where the log bolded punctuation", () => {
    // The game writes the zone as a link with the full stop outside it, so a
    // naive tag strip produces "the Nearby Plains ." and stops matching.
    expect(questLogText("in the <a href=x><b>Nearby Plains</b></a>.")).toBe(
      "in the Nearby Plains.",
    );
  });

  it("decodes the entities the log is padded with", () => {
    expect(questLogText("a&nbsp;&nbsp;b &amp; &quot;c&quot;")).toBe(
      'a b & "c"',
    );
  });
});

describe("parse", () => {
  it("reads an active quest and the step it is on", async () => {
    const entries = QuestLog.parse(await fixture("questlog_active"));

    expect(entries).toEqual([
      {
        section: "Council Quests",
        title: "Ooh, I Think I Smell a Bat.",
        text: "Find and defeat the Boss Bat, in the Bat Hole on the Nearby Plains.",
      },
    ]);
  });

  it("reads several quests sharing one blockquote", async () => {
    // The completed tab puts every quest inside a single blockquote, separated
    // only by <p>, so the blockquote cannot be the unit.
    const entries = QuestLog.parse(await fixture("questlog_completed"));

    expect(entries.map((e) => e.title)).toEqual([
      "Looking for a Larva in All the Wrong Places",
      "Ooh, I Think I Smell a Rat",
    ]);
    expect(entries[0].text).toBe(
      "You delivered a mosquito larva to the Council of Loathing. Nice work!",
    );
    expect(entries[1].text).toBe(
      "You've solved the rat problem at the Typical Tavern. Way to go!",
    );
  });

  it("does not run one quest's text on into the next", async () => {
    const entries = QuestLog.parse(await fixture("questlog_completed"));
    expect(entries[0].text).not.toMatch(/rat problem/);
  });

  it("attributes each quest to its section heading", async () => {
    const entries = QuestLog.parse(await fixture("questlog_completed"));
    expect(entries.every((e) => e.section === "Council Quests")).toBe(true);
  });

  it("ignores the tab bar above the first section", async () => {
    const entries = QuestLog.parse(await fixture("questlog_active"));
    expect(entries.map((e) => e.title)).not.toContain("current quests");
  });

  it("yields nothing for a page with no quests", () => {
    expect(QuestLog.parse("<html><body>nothing here</body></html>")).toEqual(
      [],
    );
  });
});

describe("find", () => {
  it("matches regardless of the game's own casing", async () => {
    // The log says "Am I My Trapper's Keeper?"; quest tables commonly say "my".
    const entries = QuestLog.parse(await fixture("questlog_completed"));
    expect(QuestLog.find(entries, "ooh, i think i smell a rat")?.title).toBe(
      "Ooh, I Think I Smell a Rat",
    );
  });

  it("falls back to a partial match", async () => {
    const entries = QuestLog.parse(await fixture("questlog_active"));
    expect(QuestLog.find(entries, "Smell a Bat")?.section).toBe(
      "Council Quests",
    );
  });

  it("returns null rather than a wrong quest", async () => {
    const entries = QuestLog.parse(await fixture("questlog_active"));
    expect(QuestLog.find(entries, "Trapper")).toBeNull();
  });
});

describe("requests", () => {
  it("asks for the right tab", async () => {
    const client = new Client("", "");
    const fetchText = vi
      .spyOn(client, "fetchText")
      .mockResolvedValue(await fixture("questlog_active"));
    const log = new QuestLog(client);

    await log.getActive();
    expect(fetchText).toHaveBeenCalledWith("questlog.php", {
      method: "GET",
      query: { which: 1 },
    });

    await log.getCompleted();
    expect(fetchText).toHaveBeenCalledWith("questlog.php", {
      method: "GET",
      query: { which: 2 },
    });
  });
});
