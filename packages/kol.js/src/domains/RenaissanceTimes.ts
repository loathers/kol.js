import { tz } from "@date-fns/tz";
import { addDays, isAfter, isValid, parse, subYears } from "date-fns";

import type { Client } from "../Client.js";
import { LoathingDate } from "../LoathingDate.js";

export const KNIGHTS = [
  "Open Mic Knight",
  "Poker Knight",
  "Wedding Knight",
] as const;

export type Knight = (typeof KNIGHTS)[number];
export type JoustOdds = Record<Knight, number>;
export type JoustResult = { time: Date; winner: Knight };
export type BettingCounter = {
  odds: JoustOdds | null;
  lastWinner: Knight | null;
  history: JoustResult[];
};

const KNIGHT_PATTERN = KNIGHTS.join("|");
const ODDS_ROW = new RegExp(
  `<tr><td>(${KNIGHT_PATTERN})</td><td>(\\d+)%</td>`,
  "g",
);
const LAST_WINNER = new RegExp(
  `<b>Last round:</b>\\s*(${KNIGHT_PATTERN}) won\\.`,
);
const HISTORY_ROW = new RegExp(
  `<tr><td>([A-Z][a-z]{2} \\d{1,2} \\d{1,2}:\\d{2} [ap]m)</td><td>(${KNIGHT_PATTERN})</td>`,
  "g",
);

/**
 * Parse a betting-counter time ("Jul 25 12:00 am") into an absolute Date.
 *
 * The timestamps carry no year but always name a joust from the recent past,
 * so if assuming the current server-time year lands in the future it must be
 * the previous year's. The day of slack absorbs client/server clock skew.
 */
export function parseJoustTime(text: string, now: Date): Date | null {
  const time = parse(text, "MMM d h:mm a", now, {
    in: tz(LoathingDate.SERVER_TIMEZONE),
  });
  if (!isValid(time)) return null;
  return isAfter(time, addDays(now, 1)) ? subYears(time, 1) : time;
}

/** Build a fully-typed odds record from the odds-table rows. */
function parseJoustOdds(rows: RegExpMatchArray[]): JoustOdds {
  return Object.fromEntries(
    rows.map((m) => [m[1] as Knight, Number(m[2])]),
  ) as JoustOdds;
}

/** Whether a page is the Oddsmaker's betting counter (odds posted or not). */
function isBettingCounterPage(page: string): boolean {
  return (
    page.includes("Here are the latest odds!") ||
    page.includes("The odds aren't posted yet")
  );
}

// The jousting-area entry occasionally redirects to the main map right after
// login/idle instead of forcing the choice; a single retry lands in it. If the
// retry also fails it's a different problem further attempts won't fix.
const VISIT_ATTEMPTS = 2;

export class RenaissanceTimes {
  #client: Client;

  constructor(client: Client) {
    this.#client = client;
  }

  /**
   * Visit the Jousting Area (choice 1600) and its betting counter (choice
   * 1602), then back all the way out so the account is not left mid-choice.
   * Returns the raw betting-counter page, or null when it can't be reached
   * (tower closed, or the entry keeps bouncing to the main map).
   */
  async #visitBettingCounter(): Promise<string | null> {
    return await this.#client.actionMutex.runExclusive(async () => {
      for (let attempt = 0; attempt < VISIT_ATTEMPTS; attempt++) {
        const arena = await this.#client.fetchText("place.php", {
          query: { whichplace: "twitch", action: "twitch_zone12b" },
        });
        if (arena.includes("faded back into the swirling mists")) return null;
        // Bounced to the main map instead of the jousting choice; retry.
        if (!arena.includes("Visit the Betting Counter")) continue;

        try {
          const counter = await this.#client.fetchText("choice.php", {
            query: { whichchoice: 1600, option: 4 },
          });
          if (isBettingCounterPage(counter)) return counter;
        } finally {
          await this.#backOutOfJoust();
        }
      }
      return null;
    });
  }

  /** Back out of the joust choices so the account isn't left mid-choice. */
  async #backOutOfJoust(): Promise<void> {
    try {
      await this.#client.fetchText("choice.php", {
        query: { whichchoice: 1602, option: 4 },
      });
      await this.#client.fetchText("choice.php", {
        query: { whichchoice: 1600, option: 6 },
      });
    } catch {
      // Failing to back out cleanly shouldn't mask the actual result
    }
  }

  /**
   * Read the betting counter. Returns null when it can't be reached — the tower
   * is closed, or the jousting-area entry kept bouncing to the main map.
   */
  async getBettingCounter(now = new Date()): Promise<BettingCounter | null> {
    const page = await this.#visitBettingCounter();
    return page === null ? null : RenaissanceTimes.parse(page, now);
  }

  static parse(page: string, now = new Date()): BettingCounter | null {
    if (!isBettingCounterPage(page)) return null;
    const oddsPosted = page.includes("Here are the latest odds!");

    let odds: JoustOdds | null = null;
    if (oddsPosted) {
      const oddsRows = [...page.matchAll(ODDS_ROW)];
      if (oddsRows.length === KNIGHTS.length) {
        odds = parseJoustOdds(oddsRows);
      }
    }

    const lastWinner =
      (page.match(LAST_WINNER)?.[1] as Knight | undefined) ?? null;

    const history: JoustResult[] = [];
    for (const match of page.matchAll(HISTORY_ROW)) {
      const time = parseJoustTime(match[1], now);
      if (!time) continue;
      history.push({ time, winner: match[2] as Knight });
    }

    return { odds, lastWinner, history };
  }
}
