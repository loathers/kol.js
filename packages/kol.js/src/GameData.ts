import {
  AscensionClass,
  Effect,
  EffectModifiers,
  Familiar,
  FamiliarModifiers,
  Item,
  ItemModifiers,
  Location,
  type Modifier,
  Monster,
  Path,
  Skill,
  SkillModifiers,
  createClient,
} from "data-of-loathing";

export class GameData {
  #client = createClient();
  #loadPromise: Promise<void> | null = null;

  async load(): Promise<void> {
    this.#loadPromise ??= this.#client.load();
    await this.#loadPromise;
  }

  get query() {
    return this.#client.query;
  }

  async findItemsByIds(ids: number[]): Promise<Item[]> {
    await this.load();
    return this.#client.query.find(Item, { id: { $in: ids } });
  }

  async findItemByName(name: string): Promise<Item | null> {
    await this.load();
    return this.#client.query.findOne(Item, { name: name.trim() });
  }

  async findSkillByName(name: string): Promise<Skill | null> {
    await this.load();
    return this.#client.query.findOne(Skill, { name: name.trim() });
  }

  async findSkillsByIds(ids: number[]): Promise<Skill[]> {
    await this.load();
    return this.#client.query.find(Skill, { id: { $in: ids } });
  }

  async findEffectByName(name: string): Promise<Effect | null> {
    await this.load();
    return this.#client.query.findOne(Effect, { name: name.trim() });
  }

  async findEffectsByIds(ids: number[]): Promise<Effect[]> {
    await this.load();
    return this.#client.query.find(Effect, { id: { $in: ids } });
  }

  async findFamiliarByName(name: string): Promise<Familiar | null> {
    await this.load();
    return this.#client.query.findOne(Familiar, { name: name.trim() });
  }

  async findMonsterByName(name: string): Promise<Monster | null> {
    await this.load();
    return this.#client.query.findOne(Monster, { name: name.trim() });
  }

  async findClassById(id: number): Promise<AscensionClass | null> {
    await this.load();
    return this.#client.query.findOne(AscensionClass, { id });
  }

  async findPathById(id: number): Promise<Path | null> {
    await this.load();
    return this.#client.query.findOne(Path, { id });
  }

  async findItemById(id: number): Promise<Item | null> {
    await this.load();
    return this.#client.query.findOne(Item, { id });
  }

  async findItemByDescId(descid: number): Promise<Item | null> {
    await this.load();
    return this.#client.query.findOne(Item, { descid });
  }

  async findMonsterById(id: number): Promise<Monster | null> {
    await this.load();
    return this.#client.query.findOne(Monster, { id });
  }

  async findModifiersForItemIds(
    ids: number[],
  ): Promise<Map<number, Modifier[]>> {
    await this.load();
    const rows = await this.#client.query.find(ItemModifiers, {
      item: { id: { $in: ids } },
    });
    return new Map(rows.map((r) => [r.item.id, r.modifiers]));
  }

  async findModifiersForEffectIds(
    ids: number[],
  ): Promise<Map<number, Modifier[]>> {
    await this.load();
    const rows = await this.#client.query.find(EffectModifiers, {
      effect: { id: { $in: ids } },
    });
    return new Map(rows.map((r) => [r.effect.id, r.modifiers]));
  }

  async findModifiersForSkillIds(
    ids: number[],
  ): Promise<Map<number, Modifier[]>> {
    await this.load();
    const rows = await this.#client.query.find(SkillModifiers, {
      skill: { id: { $in: ids } },
    });
    return new Map(rows.map((r) => [r.skill.id, r.modifiers]));
  }

  async findLocationById(id: number): Promise<Location | null> {
    await this.load();
    return this.#client.query.findOne(Location, { id });
  }

  async findModifiersForFamiliarId(id: number): Promise<Modifier[] | null> {
    await this.load();
    const row = await this.#client.query.findOne(FamiliarModifiers, {
      familiar: { id },
    });
    return row?.modifiers ?? null;
  }
}

export const gameData = new GameData();
