import type { Skill } from "data-of-loathing";

import type { Client } from "../Client.js";
import { gameData } from "../GameData.js";
import type {
  EvaluatedModifier,
  ExpressionContext,
  ModifierSource,
} from "../modifiers/index.js";
import { resolveModifiers } from "../modifiers/index.js";
import { deduplicate } from "../utils/deduplicate.js";
import type { ApiStatus } from "./ApiStatus.js";
import { Effects } from "./Effects.js";
import { Equipment } from "./Equipment.js";
import { familiarBaseWeight } from "./Familiar.js";

export class Modifiers {
  #client: Client;

  constructor(client: Client) {
    this.#client = client;
  }

  /**
   * Every modifier the character currently has, resolved from scratch.
   *
   * Concurrent callers share one resolution: `get(name)` runs the whole
   * pipeline, so asking for two dozen named modifiers in parallel would
   * otherwise repeat all of it two dozen times over. The shared promise is
   * dropped as soon as it settles, so a later call still reads fresh state.
   */
  getAll = deduplicate(async (): Promise<Map<string, EvaluatedModifier>> => {
    // One status fetch, not two. `api.php` is a network round trip and both
    // halves of the resolution need the same answer.
    const status = await this.#client.fetchStatus();
    const [sources, context] = await Promise.all([
      this.#buildSources(status),
      this.#buildContext(status),
    ]);
    return resolveModifiers(sources, context);
  });

  async get(name: string): Promise<EvaluatedModifier | null> {
    return (await this.getAll()).get(name) ?? null;
  }

  async #buildContext(status: ApiStatus): Promise<ExpressionContext> {
    const [skillMap, equipmentMap] = await Promise.all([
      this.#client.charSheet.getSkills(),
      this.#client.equipment.get(),
    ]);

    const skills = new Set<string>(
      [...skillMap.keys()].map((s: Skill) => s.name),
    );

    return {
      variables: {
        L: status.level,
        F:
          status.familiarexp !== undefined
            ? familiarBaseWeight(status.familiarexp)
            : 0,
      },
      prefs: {},
      skills,
      equipment: equipmentMap,
      location: this.#client.location ?? undefined,
      path: this.#client.path ?? undefined,
    };
  }

  async #buildSources(status: ApiStatus): Promise<ModifierSource[]> {
    const sources: ModifierSource[] = [];

    await Promise.all([
      this.#addEquipmentSources(sources, status),
      this.#addEffectSources(sources, status),
      this.#addSkillSources(sources),
    ]);

    return sources;
  }

  async #addEquipmentSources(
    sources: ModifierSource[],
    status: ApiStatus,
  ): Promise<void> {
    // Resolved, because a folder's entry id is an offset, not an item id.
    const resolved = await Equipment.resolveEntries(
      Equipment.parseEntries(status),
    );
    if (resolved.length === 0) return;

    const modifierMap = await gameData.findModifiersForItemIds(
      resolved.map(({ item }) => item.id),
    );

    for (const { slot, item } of resolved) {
      const mods = modifierMap.get(item.id);
      if (!mods) continue;
      sources.push({ label: `${slot}: ${item.name}`, modifiers: mods });
    }
  }

  async #addEffectSources(
    sources: ModifierSource[],
    status: ApiStatus,
  ): Promise<void> {
    const entries = Effects.parseEntries(status);
    if (entries.length === 0) return;

    const [effects, modifierMap] = await Promise.all([
      gameData.findEffectsByIds(entries.map((e) => e.id)),
      gameData.findModifiersForEffectIds(entries.map((e) => e.id)),
    ]);

    for (const effect of effects) {
      const mods = modifierMap.get(effect.id);
      if (!mods) continue;
      sources.push({ label: `effect: ${effect.name}`, modifiers: mods });
    }
  }

  async evaluateItem(itemId: number): Promise<Map<string, EvaluatedModifier>> {
    const [modsMap, context] = await Promise.all([
      gameData.findModifiersForItemIds([itemId]),
      this.#client.fetchStatus().then((status) => this.#buildContext(status)),
    ]);
    const mods = modsMap.get(itemId);
    if (!mods) return new Map();
    return resolveModifiers(
      [{ label: `item:${itemId}`, modifiers: mods }],
      context,
    );
  }

  async #addSkillSources(sources: ModifierSource[]): Promise<void> {
    const skillMap = await this.#client.charSheet.getSkills();
    const ids = [...skillMap.keys()].map((s: Skill) => s.id);
    if (ids.length === 0) return;

    const [skills, modifierMap] = await Promise.all([
      gameData.findSkillsByIds(ids),
      gameData.findModifiersForSkillIds(ids),
    ]);

    for (const skill of skills) {
      const mods = modifierMap.get(skill.id);
      if (!mods) continue;
      sources.push({ label: `skill: ${skill.name}`, modifiers: mods });
    }
  }
}
