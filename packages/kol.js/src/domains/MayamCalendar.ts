import RNG from "kol-rng";

import type { Client } from "../Client.js";
import { EffectList } from "../EffectList.js";
import { gameData } from "../GameData.js";

/** A yam battery's three effects arrive with these durations, in this order. */
export const YAM_BATTERY_DURATIONS = [10, 20, 30] as const;

/**
 * The Mayam Calendar entered Mr. Store on gameday 7750 (2024-04-30)
 */
export const MAYAM_CALENDAR_START_GAMEDAY = 7750;

const TIKI_TEMERITY = 2468;

export class MayamCalendar {
  #client: Client;

  constructor(client: Client) {
    this.#client = client;
  }

  /** The effects a yam battery would grant the logged-in player today. */
  async getYamBatteryEffects(): Promise<EffectList> {
    const status = await this.#client.fetchStatus();
    return MayamCalendar.getYamBatteryEffects(Number(status.daynumber));
  }

  static async getYamBatteryEffects(gameday: number): Promise<EffectList> {
    const pool = await gameData.getGoodEffects(TIKI_TEMERITY);
    const rng = new RNG(11 * gameday);
    return new EffectList(
      YAM_BATTERY_DURATIONS.map((duration) => {
        // Rolls against an inclusive upper bound of the pool length, so the
        // final effect comes up twice as often as the rest.
        const index = Math.min(
          rng.mtRand.roll(0, pool.length),
          pool.length - 1,
        );
        return { duration, effect: pool[index] };
      }),
    );
  }
}
