import { describe, expect, it, test, vi } from "vitest";

import { Client } from "../Client.js";
import { loadFixture } from "../testUtils.js";
import {
  RenaissanceTimes,
  RenaissanceTimesParseError,
  parseJoustTime,
} from "./RenaissanceTimes.js";

const { text } = vi.hoisted(() => ({ text: vi.fn() }));

vi.mock("../Client.js", async (importOriginal) => {
  const client = await importOriginal<typeof import("../Client.js")>();
  client.Client.prototype.login = () => Promise.resolve(true);
  client.Client.prototype.checkLoggedIn = () => Promise.resolve(true);
  client.Client.prototype.fetchText = text;
  return client;
});

const client = new Client("", "");

// The fixtures were captured at Sat Jul 25 08:43 BST 2026 (07:43 UTC)
const now = new Date("2026-07-25T07:43:00Z");

describe("RenaissanceTimes.parse", () => {
  it("parses the page while odds are not yet posted", async () => {
    const page = await loadFixture(
      import.meta.dirname,
      "renaissance_times_no_odds.html",
    );

    const result = RenaissanceTimes.parse(page, now);

    expect(result).not.toBeNull();
    expect(result?.odds).toBeNull();
    expect(result?.lastWinner).toBe("Poker Knight");
    expect(result?.history).toHaveLength(10);
    // History is newest first; times are KoL server time (UTC-7)
    expect(result?.history[0]).toEqual({
      time: new Date("2026-07-25T07:00:00Z"),
      winner: "Poker Knight",
    });
    expect(result?.history[9]).toEqual({
      time: new Date("2026-07-24T22:22:00Z"),
      winner: "Poker Knight",
    });
  });

  it("parses the page while odds are posted", async () => {
    const page = await loadFixture(
      import.meta.dirname,
      "renaissance_times_odds.html",
    );

    const result = RenaissanceTimes.parse(page, now);

    expect(result?.odds).toEqual({
      "Open Mic Knight": 1,
      "Poker Knight": 57,
      "Wedding Knight": 41,
    });
    expect(result?.lastWinner).toBe("Poker Knight");
    expect(result?.history).toHaveLength(10);
  });

  it("returns null for an unrecognisable page", () => {
    expect(RenaissanceTimes.parse("<html>whatever</html>", now)).toBeNull();
  });
});

describe("RenaissanceTimes.getBettingCounter", () => {
  it("navigates in and backs out of the choice", async () => {
    const oddsPage = await loadFixture(
      import.meta.dirname,
      "renaissance_times_odds.html",
    );
    text.mockReset();
    text
      .mockResolvedValueOnce("Jousting Area") // place.php arena
      .mockResolvedValueOnce(oddsPage) // choice 1600 option 4 -> betting counter
      .mockResolvedValueOnce("") // choice 1602 option 4 -> back to arena
      .mockResolvedValueOnce(""); // choice 1600 option 6 -> exit

    const renaissanceTimes = new RenaissanceTimes(client);
    const result = await renaissanceTimes.getBettingCounter(now);

    expect(result?.odds).toMatchObject({ "Poker Knight": 57 });
    // Backs out of both choices
    expect(text).toHaveBeenCalledWith("choice.php", {
      query: { whichchoice: 1602, option: 4 },
    });
    expect(text).toHaveBeenCalledWith("choice.php", {
      query: { whichchoice: 1600, option: 6 },
    });
  });

  it("returns null when the tower has faded into the mists", async () => {
    text.mockReset();
    text.mockResolvedValueOnce("you faded back into the swirling mists");

    const renaissanceTimes = new RenaissanceTimes(client);

    expect(await renaissanceTimes.getBettingCounter(now)).toBeNull();
    // Doesn't try to enter the counter
    expect(text).toHaveBeenCalledTimes(1);
  });

  it("throws when the betting counter page is unrecognisable", async () => {
    text.mockReset();
    text
      .mockResolvedValueOnce("Jousting Area")
      .mockResolvedValueOnce("<html>garbage</html>")
      .mockResolvedValueOnce("")
      .mockResolvedValueOnce("");

    const renaissanceTimes = new RenaissanceTimes(client);

    await expect(
      renaissanceTimes.getBettingCounter(now),
    ).rejects.toBeInstanceOf(RenaissanceTimesParseError);
  });
});

describe("parseJoustTime", () => {
  test("parses a KoL server time (UTC-7) into a UTC date", () => {
    expect(parseJoustTime("Jul 24 3:22 pm", now)).toEqual(
      new Date("2026-07-24T22:22:00Z"),
    );
  });

  test("handles midnight and noon", () => {
    expect(parseJoustTime("Jul 25 12:00 am", now)).toEqual(
      new Date("2026-07-25T07:00:00Z"),
    );
    expect(parseJoustTime("Jul 24 12:00 pm", now)).toEqual(
      new Date("2026-07-24T19:00:00Z"),
    );
  });

  test("uses the previous year when the date would otherwise be in the future", () => {
    expect(
      parseJoustTime("Dec 31 10:00 pm", new Date("2027-01-01T09:00:00Z")),
    ).toEqual(new Date("2027-01-01T05:00:00Z"));
  });

  test("returns null for garbage", () => {
    expect(parseJoustTime("not a time", now)).toBeNull();
  });
});
