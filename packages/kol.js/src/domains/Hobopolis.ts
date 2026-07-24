import type { Client } from "../Client.js";
import { ClanDungeon } from "./ClanDungeon.js";

/**
 * Hobopolis-specific clan dungeon handling, most notably the Old Sewers.
 */

export type SewerEncounter =
  /** "Despite All Your Rage" — caught in the C. H. U. M. cage. */
  | { type: "cage"; whichchoice: 211 | 212 }
  /** "Disgustin' Junction" — a sewer grate (choice 198). */
  | { type: "junction" }
  /** "Somewhat Higher and Mostly Dry" — a water valve (choice 197). */
  | { type: "higherAndDry" }
  /** "The Former or the Ladder" — the cage from the outside (choice 199). */
  | { type: "ladder" }
  /** "Pop!" — squeezed into a gnawed-through cage (choice 296). */
  | { type: "gnawedCage" }
  /** Hodgman has been defeated, the sewers are closed. */
  | { type: "hodgmanDefeated" }
  /** Already passed through the sewers and cannot adventure there. */
  | { type: "passedThrough" }
  /** Anything else — usually a combat, resolved by the autoattack macro. */
  | { type: "other" };

export type SewerProgress = {
  grates: number;
  valves: number;
};

export class HobopolisDungeon extends ClanDungeon {
  #client: Client;

  constructor(client: Client) {
    super(client);
    this.#client = client;
  }

  static parseSewerEncounter(body: string): SewerEncounter {
    if (/Despite All Your Rage/.test(body)) {
      // There are two possible choice ids for the cage encounter.
      return {
        type: "cage",
        whichchoice: / value=211>/.test(body) ? 211 : 212,
      };
    }

    if (/Disgustin' Junction/.test(body)) return { type: "junction" };
    if (/Somewhat Higher and Mostly Dry/.test(body))
      return { type: "higherAndDry" };
    if (/The Former or the Ladder/.test(body)) return { type: "ladder" };
    if (/Pop!/.test(body)) return { type: "gnawedCage" };
    if (/You shouldn't be here\./.test(body))
      return { type: "hodgmanDefeated" };

    if (
      /You've already found your way through these sewers, and you don't feel like spending any more time down there than you absolutely have to\./.test(
        body,
      )
    ) {
      return { type: "passedThrough" };
    }

    return { type: "other" };
  }

  static parseSewerProgress(raidLog: string): SewerProgress {
    let grates = 0;
    let valves = 0;

    for (const match of raidLog.matchAll(
      /opened (?:a|(?:\d+)) sewer grates? (?:\d+ times )?\((\d+) turns?\)/g,
    )) {
      grates += parseInt(match[1]);
    }

    for (const match of raidLog.matchAll(
      /lowered the water level (?:\d+ times )?\((\d+) turns?\)/g,
    )) {
      valves += parseInt(match[1]);
    }

    return { grates, valves };
  }

  /**
   * Read how many grates have been opened and valves twisted in the current
   * clan's raid log.
   *
   * Reads clan_raidlogs.php directly rather than via getCurrentRaid(), which
   * would take the client's action mutex and switch clans.
   */
  async getSewerProgress(): Promise<SewerProgress> {
    const raidLog = await this.#client.fetchText("clan_raidlogs.php");
    return HobopolisDungeon.parseSewerProgress(raidLog);
  }

  /** Whether the current clan's Old Sewers are accessible. */
  async sewersOpen(): Promise<boolean> {
    const page = await this.#client.fetchText("clan_hobopolis.php");
    return /Old Sewers/.test(page);
  }

  /** Spend a turn adventuring in the Old Sewers. */
  async exploreSewer(): Promise<SewerEncounter> {
    const body = await this.#client.fetchText("adventure.php", {
      query: { snarfblat: 166 },
    });
    return HobopolisDungeon.parseSewerEncounter(body);
  }

  async #choice(whichchoice: number, option: number): Promise<string> {
    return await this.#client.fetchText("choice.php", {
      query: { whichchoice, option },
    });
  }

  /** Stay in the cage ("Despite All Your Rage", option 2). */
  async acceptCage(): Promise<void> {
    await this.#choice(211, 2);
  }

  /**
   * Chew through the cage ("Despite All Your Rage", option 1). The choice id
   * varies, so pass the one reported by the encounter.
   */
  async chewThroughCage(
    whichchoice: 211 | 212,
  ): Promise<{ stillInChoice: boolean }> {
    const body = await this.#choice(whichchoice, 1);
    return { stillInChoice: /whichchoice/.test(body) };
  }

  /** Squeeze out of a gnawed-through cage ("Pop!", choice 296). */
  async squeezeOut(): Promise<{ stillCaged: boolean }> {
    const body = await this.#choice(296, 1);
    return { stillCaged: /Despite All Your Rage/.test(body) };
  }

  /** Open the grate at a Disgustin' Junction (choice 198). */
  async openGrate(): Promise<{ opened: boolean }> {
    const body = await this.#choice(198, 3);
    // If we were too tired to explore the tunnel, a turn was spent opening
    // the grate. Otherwise the encounter was a free turn.
    return {
      opened: /too tired to explore the tunnel on the other side/i.test(body),
    };
  }

  /** Twist the valve at Somewhat Higher and Mostly Dry (choice 197). */
  async twistValve(): Promise<{ twisted: boolean }> {
    const body = await this.#choice(197, 3);
    return {
      twisted:
        /as the water level in the sewer lowers by a couple of inches/i.test(
          body,
        ),
    };
  }

  /**
   * Try to rescue a clanmate from the cage at The Former or the Ladder
   * (choice 199, option 3). If someone is occupying the cage the response
   * differs, in which case we cannot be caged ourselves.
   */
  async rescueClanmate(): Promise<{ cageOccupied: boolean }> {
    const body = await this.#choice(199, 3);
    return {
      cageOccupied:
        !/You stare at it for 4 minutes and 33 seconds before getting bored and climbing back out of the sewer/.test(
          body,
        ),
    };
  }

  /** Fight the C. H. U. M.s at The Former or the Ladder (choice 199, option 2). */
  async fightChum(): Promise<void> {
    await this.#choice(199, 2);
  }

  /**
   * Whether we are currently trapped in the C. H. U. M. cage. Handles the
   * case where the cage has been gnawed through by squeezing back out first.
   */
  async isCaged(): Promise<boolean> {
    const page = await this.#client.fetchText("place.php");

    if (/Pop!/.test(page)) {
      const { stillCaged } = await this.squeezeOut();
      return stillCaged;
    }

    return /Despite All Your Rage/.test(page);
  }

  /** Whether the character is unexpectedly stuck in a choice adventure. */
  async stuckInChoice(): Promise<boolean> {
    const page = await this.#client.fetchText("place.php");
    return /whichchoice/.test(page);
  }
}
