import { Effect, EffectQuality } from "data-of-loathing";
import RNG from "kol-rng";

import type { Client } from "../Client.js";
import { gameData } from "../GameData.js";
import { cached } from "../utils/cached.js";

/** A yam battery's three effects arrive with these durations, in this order. */
export const YAM_BATTERY_DURATIONS = [10, 20, 30] as const;

/**
 * The Mayam Calendar entered Mr. Store on gameday 7750 (2024-04-30)
 */
export const MAYAM_CALENDAR_START_GAMEDAY = 7750;

export type YamBatteryEffect = {
  duration: number;
  effect: Effect;
};

const POOL_MAX_EFFECT_ID = 2468; // Tiki Temerity
const FISHY = 549;
const FLOUNDERING = 2218;

/**
 * The effects a yam battery can roll, in the order KoL indexes into them.
 *
 * For some reason the pool is the Two Crazy Random Summer effect pool minus Floundering.
 */
export const getYamBatteryPool = cached(async (): Promise<Effect[]> => {
  await gameData.load();
  const effects = await gameData.query.find(Effect, {});
  return effects
    .filter(
      (e) =>
        e.id <= POOL_MAX_EFFECT_ID &&
        e.quality === EffectQuality.Good &&
        (!e.nohookah || e.id === FISHY) &&
        !e.notcrs &&
        e.id !== FLOUNDERING,
    )
    .sort((a, b) => a.id - b.id);
});

export class MayamCalendar {
  #client: Client;

  constructor(client: Client) {
    this.#client = client;
  }

  /** The effects a yam battery would grant the logged-in player today. */
  async getYamBatteryEffects(): Promise<YamBatteryEffect[]> {
    const status = await this.#client.fetchStatus();
    return MayamCalendar.getYamBatteryEffects(Number(status.daynumber));
  }

  static async getYamBatteryEffects(
    gameday: number,
  ): Promise<YamBatteryEffect[]> {
    const pool = await getYamBatteryPool();
    const rng = new RNG(11 * gameday);
    return YAM_BATTERY_DURATIONS.map((duration) => {
      // Rolls against an inclusive upper bound of the pool length, so the
      // final effect comes up twice as often as the rest.
      const index = Math.min(rng.mtRand.roll(0, pool.length), pool.length - 1);
      return { duration, effect: pool[index] };
    });
  }
}
