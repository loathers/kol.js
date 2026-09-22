import { decodeHTML } from "entities";

import type { Client } from "../Client.js";

/**
 * Calculate the base weight of a familiar from its experience.
 *
 * Base weight = floor(sqrt(exp)), clamped to [1, 20] lbs.
 * This is the intrinsic weight before familiar equipment or effect bonuses.
 */
export function familiarBaseWeight(experience: number): number {
  return Math.max(1, Math.min(20, Math.floor(Math.sqrt(experience))));
}

/**
 * Familiar-type effect calculations.
 *
 * KoL familiars provide bonuses that scale with their buffed weight.
 * Different familiar types use different formulas. The "power"
 * parameter accounts for equipment that multiplies the effect
 * (e.g. a Comma Chameleon acting as a fairy has power 1, but some
 * familiars have innate multipliers).
 */

/**
 * Calculate the +item drop percentage from a fairy-type familiar.
 *
 * Fairy-type familiars increase item drops from monsters. The formula
 * is sqrt(55 * weight * power) + weight * power - 3.
 */
export function fairyItemDrop(weight: number, power = 1): number {
  return Math.sqrt(55 * (weight * power)) + weight * power - 3;
}

/**
 * Calculate the familiar weight needed to reach a given +item drop bonus.
 *
 * Inverse of fairyItemDrop — given a desired item drop percentage,
 * returns the weight needed to achieve it.
 */
export function fairyWeightForItemDrop(modifier: number, power = 1): number {
  return (2 * modifier + 61 - Math.sqrt(220 * modifier + 3685)) / (2 * power);
}

/**
 * Calculate the +meat drop percentage from a leprechaun-type familiar.
 *
 * Meat drop bonus = sqrt(220 * weight) + 2 * weight - 6
 * This is exactly 2x the fairy item drop formula.
 */
export function leprechaunMeatDrop(weight: number, power = 1): number {
  return 2 * fairyItemDrop(weight, power);
}

/**
 * Calculate the familiar weight needed to reach a given +meat drop bonus.
 *
 * Inverse of leprechaunMeatDrop — halves the target then uses the
 * fairy inverse since meat drop = 2 * fairy item drop.
 */
export function leprechaunWeightForMeatDrop(
  modifier: number,
  power = 1,
): number {
  return fairyWeightForItemDrop(modifier / 2, power);
}

/**
 * Calculate substats per combat from a volleyball-type familiar.
 *
 * Volleyball-type familiars grant a flat substat bonus per combat
 * that scales linearly with weight.
 */
export function volleyballSubstats(weight: number): number {
  return 2 + 0.2 * weight;
}

/**
 * Calculate substats per combat from a sombrero-type familiar.
 *
 * Sombrero-type familiars grant substats that scale with both the
 * familiar's weight and the monster level (ML) of the enemy fought.
 */
export function sombreroSubstats(weight: number, ml: number): number {
  return (ml / 4) * (0.1 + 0.005 * weight);
}

/**
 * Calculate the +item drop bonus needed to cap a given drop rate.
 *
 * In KoL, item drops can be "capped" at 100% with enough +item.
 * This returns the minimum +item% needed to guarantee the drop.
 */
export function itemDropBonusToCap(dropRate: number): number {
  return Math.ceil(10000 / dropRate) - 100;
}

/**
 * familiar.php — the terrarium.
 *
 * `Client.getFamiliars()` answers "which familiars does this character own",
 * which is all the library needed until now. It does not say how heavy any of
 * them is, and weight is the whole difference between a familiar that has been
 * fighting all day and one straight out of the terrarium: without it every
 * swap looks free.
 */

export type TerrariumFamiliar = {
  id: number;
  /** The species, e.g. "Hovering Sombrero". */
  race: string;
  /** What this character has named it, where it has a name. */
  nickname: string;
  /** Current weight in pounds, before equipment and effects. */
  weight: number;
  experience: number;
  kills: number;
  /**
   * Whether it can be taken out right now.
   *
   * A familiar restricted by the current path is still owned and still listed,
   * but the page gives its row no "take with you" button. On Standard that is
   * most of a long-lived terrarium, so treating unavailable as not-owned loses
   * the majority of it.
   */
  available: boolean;
};

/**
 * A row reads:
 *   <b>Big Chungus</b>, the 1-pound Hovering Sombrero (0 exp, 7,076 kills)
 *
 * Candy-hearted familiars count in candies rather than experience, so the unit
 * is matched loosely.
 */
const ROW = /<tr class="?frow([^">]*)"?[^>]*>([\s\S]*?)<\/tr>/gi;
/**
 * The id, from the take-with-you radio where there is one and from the row's
 * own image handler otherwise. A path-restricted familiar has no radio.
 */
const ID = /name=newfam value=(\d+)|fam\((\d+)\)/i;
const NICKNAME = /<b>([^<]*)<\/b>/i;
const STATS =
  /(\d+)-pound ([^(]*?)\s*\(([\d,]+)\s*(?:exp|experience|candy|candies)?(?:,\s*([\d,]+)\s*kills?)?/i;

const number = (value: string | undefined): number =>
  Number((value ?? "0").replace(/,/g, ""));

export class Familiars {
  #client: Client;

  constructor(client: Client) {
    this.#client = client;
  }

  /** Every familiar in the terrarium, with its weight and experience. */
  async list(): Promise<TerrariumFamiliar[]> {
    return Familiars.parse(await this.#client.fetchText("familiar.php"));
  }

  /**
   * Take a familiar out.
   *
   * Verified against the page's own marker rather than assumed: asking for a
   * familiar the character does not have returns a perfectly ordinary page and
   * leaves whatever was out in place.
   */
  async take(id: number): Promise<boolean> {
    const html = await this.#client.fetchText("familiar.php", {
      method: "GET",
      query: { action: "newfam", newfam: String(id) },
    });
    return new RegExp(`var currentfam = ${id};`).test(html);
  }

  static parse(html: string): TerrariumFamiliar[] {
    const found = new Map<number, TerrariumFamiliar>();

    for (const row of html.matchAll(ROW)) {
      const [text, classes] = [row[0], row[1] ?? ""];
      const ids = ID.exec(text);
      const id = Number(ids?.[1] ?? ids?.[2]);
      const stats = STATS.exec(text);
      if (!id || !stats) continue;

      found.set(id, {
        id,
        race: decodeHTML(stats[2]).trim(),
        nickname: decodeHTML(NICKNAME.exec(text)?.[1] ?? "").trim(),
        weight: Number(stats[1]),
        experience: number(stats[3]),
        kills: number(stats[4]),
        available: !/\bexpired\b/i.test(classes),
      });
    }

    return [...found.values()];
  }
}
