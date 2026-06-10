export type AggregationRule =
  | "additive"
  | "min"
  | "max"
  | "override"
  | "collect";
export type ModifierKind = "numeric" | "boolean" | "string";

export type DRTier = {
  upTo: number;
  ratio: number;
};

export type ModifierDef = {
  aggregation: AggregationRule;
  kind: ModifierKind;
  diminishingReturns?: DRTier[];
};

const DEFAULT_DEF: ModifierDef = { aggregation: "additive", kind: "numeric" };
const UNKNOWN_DEF: ModifierDef = { aggregation: "override", kind: "string" };

export const CATALOG: Record<string, ModifierDef> = {
  // Stats
  Muscle: DEFAULT_DEF,
  Mysticality: DEFAULT_DEF,
  Moxie: DEFAULT_DEF,
  "Muscle Percent": DEFAULT_DEF,
  "Mysticality Percent": DEFAULT_DEF,
  "Moxie Percent": DEFAULT_DEF,
  "Muscle Limit": { aggregation: "min", kind: "numeric" },
  "Mysticality Limit": { aggregation: "min", kind: "numeric" },
  "Moxie Limit": { aggregation: "min", kind: "numeric" },

  // HP / MP
  "Maximum HP": DEFAULT_DEF,
  "Maximum MP": DEFAULT_DEF,
  "Maximum HP Percent": DEFAULT_DEF,
  "Maximum MP Percent": DEFAULT_DEF,
  // HP/MP Regen Min/Max handled via RANGE_PAIRS — not in CATALOG
  "Base Resting HP": DEFAULT_DEF,
  "Base Resting MP": DEFAULT_DEF,
  "Bonus Resting HP": DEFAULT_DEF,
  "Bonus Resting MP": DEFAULT_DEF,
  "Resting HP Percent": DEFAULT_DEF,
  "Resting MP Percent": DEFAULT_DEF,

  // Drops
  "Item Drop": DEFAULT_DEF,
  "Meat Drop": DEFAULT_DEF,
  "Food Drop": DEFAULT_DEF,
  "Booze Drop": DEFAULT_DEF,
  "Candy Drop": DEFAULT_DEF,
  "Hat Drop": DEFAULT_DEF,
  "Pants Drop": DEFAULT_DEF,
  "Weapon Drop": DEFAULT_DEF,
  "Accessory Drop": DEFAULT_DEF,
  "Gear Drop": DEFAULT_DEF,
  "Item Drop (sporadic)": DEFAULT_DEF,
  "Meat Drop (sporadic)": DEFAULT_DEF,
  "Meat Bonus": DEFAULT_DEF,
  "Sprinkle Drop": DEFAULT_DEF,
  "Spleen Drop": DEFAULT_DEF,
  "Potion Drop": DEFAULT_DEF,
  "Rubee Drop": DEFAULT_DEF,
  "Kruegerand Drop": DEFAULT_DEF,
  "MPC Drop": DEFAULT_DEF,
  "Piece of Twelve Drop": DEFAULT_DEF,

  // Combat
  "Monster Level": DEFAULT_DEF,
  "Combat Rate": {
    aggregation: "additive",
    kind: "numeric",
    diminishingReturns: [
      { upTo: 25, ratio: 1 },
      { upTo: 75, ratio: 5 },
      { upTo: Infinity, ratio: Infinity },
    ],
  },
  "Combat Rate (Underwater)": DEFAULT_DEF,
  Initiative: DEFAULT_DEF,
  "Initiative Penalty": DEFAULT_DEF,
  "Critical Hit Percent": DEFAULT_DEF,
  "Spell Critical Percent": DEFAULT_DEF,
  "Never Fumble": { aggregation: "additive", kind: "boolean" },
  Fumble: { aggregation: "additive", kind: "boolean" },
  "Attacks Can't Miss": { aggregation: "additive", kind: "boolean" },
  "Reduce Enemy Defense": DEFAULT_DEF,
  "Weakens Monster": DEFAULT_DEF,
  "Weakens Monster on Critical Hit": DEFAULT_DEF,
  "Damage Aura": DEFAULT_DEF,
  "Sporadic Damage Aura": DEFAULT_DEF,

  // Damage
  "Weapon Damage": DEFAULT_DEF,
  "Weapon Damage Percent": DEFAULT_DEF,
  "Ranged Damage": DEFAULT_DEF,
  "Ranged Damage Percent": DEFAULT_DEF,
  "Spell Damage": DEFAULT_DEF,
  "Spell Damage Percent": DEFAULT_DEF,
  "Hot Damage": DEFAULT_DEF,
  "Cold Damage": DEFAULT_DEF,
  "Stench Damage": DEFAULT_DEF,
  "Sleaze Damage": DEFAULT_DEF,
  "Spooky Damage": DEFAULT_DEF,
  "Hot Spell Damage": DEFAULT_DEF,
  "Cold Spell Damage": DEFAULT_DEF,
  "Stench Spell Damage": DEFAULT_DEF,
  "Sleaze Spell Damage": DEFAULT_DEF,
  "Spooky Spell Damage": DEFAULT_DEF,
  "DB Combat Damage": DEFAULT_DEF,
  "Sixgun Damage": DEFAULT_DEF,
  "Damage Absorption": DEFAULT_DEF,
  "Damage Reduction": DEFAULT_DEF,
  Thorns: DEFAULT_DEF,
  "Sporadic Thorns": DEFAULT_DEF,
  "Combat Item Damage Percent": DEFAULT_DEF,

  // Elemental resistance
  "Hot Resistance": DEFAULT_DEF,
  "Cold Resistance": DEFAULT_DEF,
  "Stench Resistance": DEFAULT_DEF,
  "Sleaze Resistance": DEFAULT_DEF,
  "Spooky Resistance": DEFAULT_DEF,
  "Slime Resistance": DEFAULT_DEF,
  "Supercold Resistance": DEFAULT_DEF,
  "Drippy Resistance": DEFAULT_DEF,
  "Hot Immunity": { aggregation: "max", kind: "boolean" },
  "Cold Immunity": { aggregation: "max", kind: "boolean" },
  "Stench Immunity": { aggregation: "max", kind: "boolean" },
  "Sleaze Immunity": { aggregation: "max", kind: "boolean" },
  "Spooky Immunity": { aggregation: "max", kind: "boolean" },
  "Hot Vulnerability": DEFAULT_DEF,
  "Cold Vulnerability": DEFAULT_DEF,
  "Stench Vulnerability": DEFAULT_DEF,
  "Sleaze Vulnerability": DEFAULT_DEF,
  "Spooky Vulnerability": DEFAULT_DEF,

  // Experience
  Experience: DEFAULT_DEF,
  "Experience (Muscle)": DEFAULT_DEF,
  "Experience (Mysticality)": DEFAULT_DEF,
  "Experience (Moxie)": DEFAULT_DEF,
  "Experience (familiar)": DEFAULT_DEF,
  "Experience Percent (Muscle)": DEFAULT_DEF,
  "Experience Percent (Mysticality)": DEFAULT_DEF,
  "Experience Percent (Moxie)": DEFAULT_DEF,

  // Familiar
  "Familiar Weight": DEFAULT_DEF,
  "Familiar Weight (hidden)": DEFAULT_DEF,
  "Familiar Damage": DEFAULT_DEF,
  "Familiar Action Bonus": DEFAULT_DEF,
  "Underwater Familiar": { aggregation: "additive", kind: "boolean" },

  // Misc stats
  Adventures: DEFAULT_DEF,
  "PvP Fights": DEFAULT_DEF,
  "Mana Cost": DEFAULT_DEF,
  "Mana Cost (combat)": DEFAULT_DEF,
  Smithsness: DEFAULT_DEF,
  Clowniness: DEFAULT_DEF,
  Raveosity: DEFAULT_DEF,
  "Hobo Power": DEFAULT_DEF,
  "Pool Skill": DEFAULT_DEF,
  "Fishing Skill": DEFAULT_DEF,
  "Pickpocket Chance": DEFAULT_DEF,
  "Extra Pickpocket": DEFAULT_DEF,
  "Negative Status Resist": DEFAULT_DEF,
  "Minstrel Level": DEFAULT_DEF,
  Luck: DEFAULT_DEF,
  "Stinky Cheese": DEFAULT_DEF,
  Surgeonosity: DEFAULT_DEF,
  "WarBear Armor Penetration": DEFAULT_DEF,
  "Drippy Damage": DEFAULT_DEF,
  "Slime Hates It": DEFAULT_DEF,

  // Boolean flags
  "Single Equip": { aggregation: "additive", kind: "boolean" },
  "Softcore Only": { aggregation: "additive", kind: "boolean" },
  "Free Pull": { aggregation: "additive", kind: "boolean" },
  "No Pull": { aggregation: "additive", kind: "boolean" },
  "Lasts Until Rollover": { aggregation: "additive", kind: "boolean" },
  Breakable: { aggregation: "additive", kind: "boolean" },
  "Adventure Randomly": { aggregation: "additive", kind: "boolean" },
  "Adventure Underwater": { aggregation: "additive", kind: "boolean" },
  Blind: { aggregation: "additive", kind: "boolean" },
  "Moxie Controls MP": { aggregation: "additive", kind: "boolean" },
  "Moxie May Control MP": { aggregation: "additive", kind: "boolean" },
  Equalize: { aggregation: "additive", kind: "boolean" },

  // String-valued (effect names, class names, etc.)
  // Effect / Rollover Effect use "collect" — values are gathered in order and assembled
  // into effect-grants tuples by POSITIONAL_GROUPS in the resolver.
  Effect: { aggregation: "collect", kind: "string" },
  "Effect Duration": { aggregation: "collect", kind: "numeric" },
  "Rollover Effect": { aggregation: "collect", kind: "string" },
  "Rollover Effect Duration": { aggregation: "collect", kind: "numeric" },
  "Familiar Effect": { aggregation: "override", kind: "string" },
  "Conditional Skill (Equipped)": { aggregation: "collect", kind: "string" },
  "Conditional Skill (Inventory)": { aggregation: "collect", kind: "string" },
  Class: { aggregation: "override", kind: "string" },
  "Equips On": { aggregation: "override", kind: "string" },
  Recipe: { aggregation: "override", kind: "string" },
  "Wiki Name": { aggregation: "override", kind: "string" },
  "Last Available": { aggregation: "override", kind: "string" },
  Skill: { aggregation: "collect", kind: "string" },
};

export function getModifierDef(name: string): ModifierDef {
  return CATALOG[name] ?? UNKNOWN_DEF;
}

export type PositionalGroupDef = {
  primary: string;
  secondary: string;
};

export const POSITIONAL_GROUPS: PositionalGroupDef[] = [
  { primary: "Effect", secondary: "Effect Duration" },
  { primary: "Rollover Effect", secondary: "Rollover Effect Duration" },
];

export type RangePairDef = {
  min: string;
  max: string;
  resultName: string;
};

export const RANGE_PAIRS: RangePairDef[] = [
  { min: "HP Regen Min", max: "HP Regen Max", resultName: "HP Regen" },
  { min: "MP Regen Min", max: "MP Regen Max", resultName: "MP Regen" },
];
