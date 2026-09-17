import { Effect } from "data-of-loathing";

export type EffectDuration = {
  effect: Effect;
  duration: number;
};

/**
 * An ordered list of effects and the turns that come with them.
 *
 * The same effect can appear more than once — a yam battery can roll one
 * effect into two of its three slots — so iteration yields every entry in the
 * order it was added. Use {@link EffectList.toMap} to collapse duplicates,
 * summing their durations.
 */
export class EffectList implements Iterable<EffectDuration> {
  #entries: EffectDuration[];

  constructor(entries: Iterable<EffectDuration> = []) {
    this.#entries = [...entries];
  }

  get size(): number {
    return this.#entries.length;
  }

  [Symbol.iterator](): Iterator<EffectDuration> {
    return this.#entries[Symbol.iterator]();
  }

  /** Appends an entry, keeping any existing entry for the same effect. */
  add(effect: Effect, duration: number): this {
    this.#entries.push({ effect, duration });
    return this;
  }

  /**
   * The durations keyed by effect, with duplicates summed. Keys stay in the
   * order each effect was first added.
   */
  toMap(): Map<Effect, number> {
    return this.#entries.reduce<Map<Effect, number>>(
      (map, { effect, duration }) =>
        map.set(effect, (map.get(effect) ?? 0) + duration),
      new Map(),
    );
  }

  has(effect: Effect): boolean {
    return this.#entries.some((entry) => entry.effect === effect);
  }

  /** The total turns of `effect`, summed across every entry for it. */
  durationOf(effect: Effect): number {
    return this.#entries.reduce(
      (total, entry) =>
        entry.effect === effect ? total + entry.duration : total,
      0,
    );
  }
}
