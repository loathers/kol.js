import { parseAdventureBody } from "./Adventure.js";
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
  static parseSewerEncounter(body: string): SewerEncounter {
    const parsed = parseAdventureBody(body);
    const name = "name" in parsed ? parsed.name : "";

    if (name === "Despite All Your Rage") {
      // There are two possible choice ids for the cage encounter.
      return {
        type: "cage",
        whichchoice: parsed.kind === "choice" && parsed.id === 212 ? 212 : 211,
      };
    }

    if (name === "Disgustin' Junction") return { type: "junction" };
    if (name === "Somewhat Higher and Mostly Dry")
      return { type: "higherAndDry" };
    if (name === "The Former or the Ladder") return { type: "ladder" };
    if (name === "Pop!") return { type: "gnawedCage" };

    // These are plain-text pages with no encounter name to extract
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
      /opened (?:a|\d+) sewer grates? (?:\d+ times )?\((\d+) turns?\)/g,
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
    const raidLog = await this.client.fetchText("clan_raidlogs.php");
    return HobopolisDungeon.parseSewerProgress(raidLog);
  }

  /** Whether the current clan's Old Sewers are accessible. */
  async sewersOpen(): Promise<boolean> {
    const page = await this.client.fetchText("clan_hobopolis.php");
    return /Old Sewers/.test(page);
  }

  /** Close the current clan's Hobopolis instance, ending the raid. */
  async close() {
    return this.closeDungeon("hobopolis");
  }

  /**
   * Open a fresh Hobopolis instance in the current clan (1,000,000 meat
   * from the clan coffer).
   */
  async open() {
    return this.openDungeon("hobopolis");
  }

  /** Spend a turn adventuring in the Old Sewers. */
  async exploreSewer(): Promise<SewerEncounter> {
    const result = await this.client.adventure.adventure(166);
    if (!result.success) return { type: "other" };
    return HobopolisDungeon.parseSewerEncounter(result.body);
  }

  /** Stay in the cage ("Despite All Your Rage", option 2). */
  async acceptCage(): Promise<void> {
    await this.client.adventure.choice(211, 2);
  }

  /**
   * Chew through the cage ("Despite All Your Rage", option 1). The choice id
   * varies, so pass the one reported by the encounter.
   */
  async chewThroughCage(
    whichchoice: 211 | 212,
  ): Promise<{ stillInChoice: boolean }> {
    const result = await this.client.adventure.choice(whichchoice, 1);
    return { stillInChoice: result.success && result.type === "choice" };
  }

  /** Squeeze out of a gnawed-through cage ("Pop!", choice 296). */
  async squeezeOut(): Promise<{ stillCaged: boolean }> {
    const result = await this.client.adventure.choice(296, 1);
    return {
      stillCaged:
        result.success &&
        result.type === "choice" &&
        result.name === "Despite All Your Rage",
    };
  }

  /** Open the grate at a Disgustin' Junction (choice 198). */
  async openGrate(): Promise<{ opened: boolean }> {
    const result = await this.client.adventure.choice(198, 3);
    // If we were too tired to explore the tunnel, a turn was spent opening
    // the grate. Otherwise the encounter was a free turn.
    return {
      opened:
        result.success &&
        /too tired to explore the tunnel on the other side/i.test(result.body),
    };
  }

  /** Twist the valve at Somewhat Higher and Mostly Dry (choice 197). */
  async twistValve(): Promise<{ twisted: boolean }> {
    const result = await this.client.adventure.choice(197, 3);
    return {
      twisted:
        result.success &&
        /as the water level in the sewer lowers by a couple of inches/i.test(
          result.body,
        ),
    };
  }

  /**
   * Try to rescue a clanmate from the cage at The Former or the Ladder
   * (choice 199, option 3). If someone is occupying the cage the response
   * differs, in which case we cannot be caged ourselves.
   */
  async rescueClanmate(): Promise<{ cageOccupied: boolean }> {
    const result = await this.client.adventure.choice(199, 3);
    return {
      cageOccupied:
        !result.success ||
        !/You stare at it for 4 minutes and 33 seconds before getting bored and climbing back out of the sewer/.test(
          result.body,
        ),
    };
  }

  /** Fight the C. H. U. M.s at The Former or the Ladder (choice 199, option 2). */
  async fightChum(): Promise<void> {
    await this.client.adventure.choice(199, 2);
  }

  /**
   * Whether we are currently trapped in the C. H. U. M. cage. Handles the
   * case where the cage has been gnawed through by squeezing back out first.
   */
  async isCaged(): Promise<boolean> {
    const encounter = await this.client.adventure.currentEncounter();
    if (encounter?.type !== "choice") return false;

    if (encounter.name === "Pop!") {
      const { stillCaged } = await this.squeezeOut();
      return stillCaged;
    }

    return encounter.name === "Despite All Your Rage";
  }

  /** Whether the character is unexpectedly stuck in a choice adventure. */
  async stuckInChoice(): Promise<boolean> {
    return this.client.adventure.inChoice();
  }
}
