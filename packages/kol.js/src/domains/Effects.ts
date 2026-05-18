import { Effect } from "data-of-loathing";

import type { Client } from "../Client.js";
import { gameData } from "../GameData.js";
import { cached } from "../utils/cached.js";
import type { ApiStatus } from "./ApiStatus.js";

type ParsedEntry = { id: number; duration: number };

export class Effects {
  #client: Client;
  #pending: Array<(map: Map<Effect, number>) => void> = [];

  constructor(client: Client) {
    this.#client = client;
    client.on("apiStatus", async (status) => {
      const map = await Effects.buildMap(status);
      this.get.setValue(map);
      for (const resolve of this.#pending.splice(0)) resolve(map);
    });
  }

  static parseEntries(status: ApiStatus): ParsedEntry[] {
    const effectEntries = Object.values(status.effects).map(
      ([, duration, , , id]) => ({ id, duration }),
    );
    const intrinsicEntries = Object.values(status.intrinsics).map(
      ([, , , id]) => ({ id, duration: Infinity }),
    );
    return [...effectEntries, ...intrinsicEntries];
  }

  static async buildMap(status: ApiStatus): Promise<Map<Effect, number>> {
    const entries = Effects.parseEntries(status);
    const effects = await gameData.findEffectsByIds(entries.map((e) => e.id));
    const byId = new Map(effects.map((e) => [e.id, e]));
    return new Map(
      entries.flatMap(({ id, duration }) => {
        const effect = byId.get(id);
        return effect ? [[effect, duration]] : [];
      }),
    );
  }

  get = cached(async (): Promise<Map<Effect, number>> => {
    return new Promise<Map<Effect, number>>((resolve, reject) => {
      this.#pending.push(resolve);
      this.#client.fetchStatus().catch(reject);
    });
  });

  async hasEffect(effect: Effect): Promise<boolean> {
    return (await this.get()).has(effect);
  }

  async remainingEffectTurns(effect: Effect): Promise<number> {
    return (await this.get()).get(effect) ?? 0;
  }
}
