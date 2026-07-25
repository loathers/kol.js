import type { Client } from "../Client.js";

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

export class RenaissanceTimesParseError extends Error {
  constructor() {
    super("Could not parse the Renaissance Times betting counter");
    this.name = "RenaissanceTimesParseError";
  }
}

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

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// KoL server time is fixed UTC-7 (Arizona, no DST)
const SERVER_UTC_OFFSET_HOURS = 7;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// Betting counter times ("Jul 25 12:00 am") carry no year, so infer it from
// the current server-time year, stepping back one if that lands in the future
// (the history only covers 72 hours, so anything further ahead is a wrap).
export function parseJoustTime(text: string, now: Date): Date | null {
  const match = text.match(
    /^([A-Z][a-z]{2}) (\d{1,2}) (\d{1,2}):(\d{2}) ([ap]m)$/,
  );
  if (!match) return null;

  const month = MONTHS.indexOf(match[1]);
  if (month < 0) return null;

  const day = Number(match[2]);
  const hour = (Number(match[3]) % 12) + (match[5] === "pm" ? 12 : 0);
  const minute = Number(match[4]);

  const serverNow = new Date(now.getTime() - SERVER_UTC_OFFSET_HOURS * HOUR);
  const serverYear = serverNow.getUTCFullYear();
  const utcHour = hour + SERVER_UTC_OFFSET_HOURS;

  let time = Date.UTC(serverYear, month, day, utcHour, minute);
  if (time - now.getTime() > 2 * DAY) {
    time = Date.UTC(serverYear - 1, month, day, utcHour, minute);
  }

  return new Date(time);
}

export class RenaissanceTimes {
  #client: Client;

  constructor(client: Client) {
    this.#client = client;
  }

  // Visit the Jousting Area (choice 1600) and its betting counter (choice
  // 1602), then back all the way out so the account is not left mid-choice.
  // Returns null when the tower has faded back into the mists (i.e. closed).
  async #visitBettingCounter(): Promise<string | null> {
    return await this.#client.actionMutex.runExclusive(async () => {
      const arena = await this.#client.fetchText("place.php", {
        query: { whichplace: "twitch", action: "twitch_zone12b" },
      });
      if (arena.includes("faded back into the swirling mists")) return null;

      try {
        return await this.#client.fetchText("choice.php", {
          query: { whichchoice: 1600, option: 4 },
        });
      } finally {
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
    });
  }

  // Returns null when the tower is closed; throws if the page is present but
  // unrecognizable.
  async getBettingCounter(now = new Date()): Promise<BettingCounter | null> {
    const page = await this.#visitBettingCounter();
    if (page === null) return null;

    const result = RenaissanceTimes.parse(page, now);
    if (!result) throw new RenaissanceTimesParseError();
    return result;
  }

  static parse(page: string, now = new Date()): BettingCounter | null {
    const oddsPosted = page.includes("Here are the latest odds!");
    if (!oddsPosted && !page.includes("The odds aren't posted yet"))
      return null;

    let odds: JoustOdds | null = null;
    if (oddsPosted) {
      const oddsRows = [...page.matchAll(ODDS_ROW)];
      if (oddsRows.length === KNIGHTS.length) {
        odds = Object.fromEntries(
          oddsRows.map((m) => [m[1], Number(m[2])]),
        ) as JoustOdds;
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
