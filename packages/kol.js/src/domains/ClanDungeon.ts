import type { Client, Result } from "../Client.js";

export type ClanDungeonName = "hobopolis" | "slimetube" | "dreadsylvania";

const DUNGEON_CLOSE_ACTIONS: Record<ClanDungeonName, string> = {
  hobopolis: "floodsewer",
  slimetube: "sealtube",
  dreadsylvania: "foldmap",
};

// Opening pays the instance cost from the clan coffer: Hobopolis 1,000,000,
// The Slime Tube 250,000, Dreadsylvania 1,000,000.
const DUNGEON_OPEN_ACTIONS: Record<ClanDungeonName, string> = {
  hobopolis: "cleansewer",
  slimetube: "cleanspot",
  dreadsylvania: "translatemap",
};

export class RaidLogMissingError extends Error {
  constructor() {
    super("Raid log missing");
    this.name = "RaidLogMissingError";
  }
}

export type RaidLogEvent =
  | {
      type: "kill";
      playerName: string;
      playerId: number;
      monster: string;
      count: number;
      boss: boolean;
    }
  | {
      type: "defeat";
      playerName: string;
      playerId: number;
      monster: string;
      count: number;
      boss: boolean;
    }
  | {
      type: "loot";
      playerName: string;
      playerId: number;
      item: string;
      recipientName: string;
      recipientId: number;
    };

export const PLAYER_PREFIX = `([A-Za-z0-9\\-_ ]+)\\s+\\(#(\\d+)\\)\\s+`;

const KILL_MULTI = new RegExp(
  `^${PLAYER_PREFIX}defeated\\s+(.+?)\\s+x\\s+(\\d+)`,
  "i",
);
const KILL_SINGLE = new RegExp(
  `^${PLAYER_PREFIX}defeated\\s+(.+?)\\s+\\(1 turn\\)`,
  "i",
);
const DEFEAT_MULTI = new RegExp(
  `^${PLAYER_PREFIX}was defeated by\\s+(.+?)\\s+x\\s+(\\d+)`,
  "i",
);
const DEFEAT_SINGLE = new RegExp(
  `^${PLAYER_PREFIX}was defeated by\\s+(.+?)\\s+\\(1 turn\\)`,
  "i",
);
const LOOT = new RegExp(
  `^${PLAYER_PREFIX}distributed\\s+(.+?)\\s+to\\s+(.+?)\\s+\\(#(\\d+)\\)`,
  "i",
);

function matchKill(line: string, bossNames: string[]): RaidLogEvent | null {
  const multi = line.match(KILL_MULTI);
  if (multi) {
    const monster = multi[3].trim();
    return {
      type: "kill",
      playerName: multi[1].trim(),
      playerId: parseInt(multi[2]),
      monster,
      count: parseInt(multi[4]),
      boss: bossNames.some((b) =>
        monster.toLowerCase().includes(b.toLowerCase()),
      ),
    };
  }

  const single = line.match(KILL_SINGLE);
  if (single) {
    const monster = single[3].trim();
    return {
      type: "kill",
      playerName: single[1].trim(),
      playerId: parseInt(single[2]),
      monster,
      count: 1,
      boss: bossNames.some((b) =>
        monster.toLowerCase().includes(b.toLowerCase()),
      ),
    };
  }

  return null;
}

function matchDefeat(line: string, bossNames: string[]): RaidLogEvent | null {
  const multi = line.match(DEFEAT_MULTI);
  if (multi) {
    const monster = multi[3].trim();
    return {
      type: "defeat",
      playerName: multi[1].trim(),
      playerId: parseInt(multi[2]),
      monster,
      count: parseInt(multi[4]),
      boss: bossNames.some((b) =>
        monster.toLowerCase().includes(b.toLowerCase()),
      ),
    };
  }

  const single = line.match(DEFEAT_SINGLE);
  if (single) {
    const monster = single[3].trim();
    return {
      type: "defeat",
      playerName: single[1].trim(),
      playerId: parseInt(single[2]),
      monster,
      count: 1,
      boss: bossNames.some((b) =>
        monster.toLowerCase().includes(b.toLowerCase()),
      ),
    };
  }

  return null;
}

function matchLoot(line: string): RaidLogEvent | null {
  const match = line.match(LOOT);
  if (!match) return null;
  return {
    type: "loot",
    playerName: match[1].trim(),
    playerId: parseInt(match[2]),
    item: match[3].trim(),
    recipientName: match[4].trim(),
    recipientId: parseInt(match[5]),
  };
}

/**
 * Try to parse a single stripped log line into a base raid log event.
 * Returns null if the line doesn't match any known pattern.
 */
export function parseLine(
  line: string,
  bossNames: string[],
): RaidLogEvent | null {
  return (
    matchKill(line, bossNames) ??
    matchDefeat(line, bossNames) ??
    matchLoot(line)
  );
}

/**
 * Service class for interacting with KoL clan dungeons.
 * Handles joining clans, fetching raid logs, and creating
 * raid instances from the fetched HTML.
 */
export class ClanDungeon {
  protected client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  /**
   * Close a dungeon in the current clan, ending its active raid. Requires
   * dungeon administration rights. Fails if the dungeon still has
   * undistributed loot.
   */
  async closeDungeon(dungeon: ClanDungeonName): Promise<Result> {
    const action = DUNGEON_CLOSE_ACTIONS[dungeon];
    const response = await this.client.fetchText("clan_basement.php", {
      query: { action, confirm: "on" },
    });
    if (/undistributed loot from that dungeon/i.test(response))
      return { success: false, reason: "Dungeon has undistributed loot" };
    // An open dungeon shows its close form on the basement page, so its
    // absence confirms the close took effect.
    if (response.includes(`value="${action}"`))
      return { success: false, reason: "Dungeon is still open" };
    return { success: true };
  }

  /**
   * Open a dungeon in the current clan, starting a fresh raid paid for from
   * the clan coffer. Requires dungeon administration rights.
   */
  async openDungeon(dungeon: ClanDungeonName): Promise<Result> {
    const response = await this.client.fetchText("clan_basement.php", {
      method: "POST",
      form: { action: DUNGEON_OPEN_ACTIONS[dungeon] },
    });
    // A newly opened dungeon shows its close form on the basement page
    if (!response.includes(`value="${DUNGEON_CLOSE_ACTIONS[dungeon]}"`))
      return { success: false, reason: "Dungeon did not open" };
    return { success: true };
  }

  async getCurrentRaid(clanId: number): Promise<string> {
    return await this.client.actionMutex.runExclusive(async () => {
      await this.client.ensureClan(clanId);
      const log = await this.client.fetchText("clan_raidlogs.php");
      if (!log) throw new RaidLogMissingError();
      return log;
    });
  }

  async getRaidById(clanId: number, raidId: number): Promise<string> {
    return await this.client.actionMutex.runExclusive(async () => {
      await this.client.ensureClan(clanId);
      return await this.client.fetchText("clan_viewraidlog.php", {
        query: {
          viewlog: raidId,
          backstart: 0,
        },
      });
    });
  }

  async getRaidIds(clanId: number, exclude: number[] = []): Promise<number[]> {
    return await this.client.actionMutex.runExclusive(async () => {
      await this.client.ensureClan(clanId);
      let raidLogs = await this.client.fetchText("clan_oldraidlogs.php");
      const raidIds: number[] = [];
      let row = 0;
      let done = false;
      while (
        !raidLogs.includes("No previous Clan Dungeon records found") &&
        !done
      ) {
        const matches =
          raidLogs.match(
            /kisses<\/td><td class=tiny>\[<a href="clan_viewraidlog\.php\?viewlog=(?<id>\d+)/g,
          ) || [];
        for (const id of matches) {
          const cleanId = Number(id.replace(/\D/g, ""));
          if (exclude.includes(cleanId)) {
            done = true;
            break;
          }
          raidIds.push(cleanId);
        }
        if (!done) {
          row += 10;
          raidLogs = await this.client.fetchText("clan_oldraidlogs.php", {
            query: {
              startrow: row,
            },
          });
        }
      }
      return raidIds;
    });
  }
}
