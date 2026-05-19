import type { Skill } from "data-of-loathing";

import { familiarBaseWeight } from "./Familiar.js";

import type { Client } from "../Client.js";
import { gameData } from "../GameData.js";
import type {
  EvaluatedModifier,
  ExpressionContext,
  ModifierSource,
} from "../modifiers/index.js";
import { resolveModifiers } from "../modifiers/index.js";
import { Effects } from "./Effects.js";
import { Equipment } from "./Equipment.js";

export class Modifiers {
  #client: Client;

  constructor(client: Client) {
    this.#client = client;
  }

  async getAll(): Promise<Map<string, EvaluatedModifier>> {
    const [sources, context] = await Promise.all([
      this.#buildSources(),
      this.#buildContext(),
    ]);
    return resolveModifiers(sources, context);
  }

  async get(name: string): Promise<EvaluatedModifier | null> {
    return (await this.getAll()).get(name) ?? null;
  }

  async #buildContext(): Promise<ExpressionContext> {
    const [status, skillMap, equipmentMap] = await Promise.all([
      this.#client.fetchStatus(),
      this.#client.charSheet.getSkills(),
      this.#client.equipment.get(),
    ]);

    const skills = new Set<string>(
      [...skillMap.keys()].map((s: Skill) => s.name),
    );

    return {
      variables: {
        L: status.level,
        F: status.familiarexp !== undefined ? familiarBaseWeight(status.familiarexp) : 0,
      },
      prefs: {},
      skills,
      equipment: equipmentMap,
      location: this.#client.location ?? undefined,
      path: this.#client.path ?? undefined,
    };
  }

  async #buildSources(): Promise<ModifierSource[]> {
    const status = await this.#client.fetchStatus();
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
    status: Awaited<ReturnType<Client["fetchStatus"]>>,
  ): Promise<void> {
    const entries = Equipment.parseEntries(status).filter((e) => e.id > 0);
    if (entries.length === 0) return;

    const [items, modifierMap] = await Promise.all([
      gameData.findItemsByIds(entries.map((e) => e.id)),
      gameData.findModifiersForItemIds(entries.map((e) => e.id)),
    ]);
    const itemById = new Map(items.map((item) => [item.id, item]));

    for (const entry of entries) {
      const item = itemById.get(entry.id);
      const mods = modifierMap.get(entry.id);
      if (!item || !mods) continue;
      sources.push({ label: `${entry.slot}: ${item.name}`, modifiers: mods });
    }
  }

  async #addEffectSources(
    sources: ModifierSource[],
    status: Awaited<ReturnType<Client["fetchStatus"]>>,
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
      this.#buildContext(),
    ]);
    const mods = modsMap.get(itemId);
    if (!mods) return new Map();
    return resolveModifiers([{ label: `item:${itemId}`, modifiers: mods }], context);
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
