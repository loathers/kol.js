import type { Modifier } from "data-of-loathing";
import RNG from "kol-rng";

import type { Client } from "../Client.js";

// Two tickets each for stat, element and monster; one for resistance. This is the roll order.
const TICKETS = [
  "stat",
  "stat",
  "element",
  "element",
  "resistance",
  "monster",
  "monster",
] as const;

const STATS = [
  "Muscle",
  "Mysticality",
  "Moxie",
  "Weapon Damage",
  "Spell Damage",
];

const ELEMENTS = ["Hot", "Cold", "Spooky", "Stench", "Sleaze"];

const MONSTER_TYPES = [
  "Orcs",
  "Skeletons",
  "Zombies",
  "Vampires",
  "Werewolves",
  "Ghosts",
  "Bugbears",
];

const BONUSES: Modifier[] = [
  { name: "Initiative", value: "+15" },
  { name: "Critical Hit Percent", value: "+20" },
  { name: "Item Drop", value: "+10" },
  { name: "Meat Drop", value: "+20" },
  { name: "Familiar Weight", value: "+5" },
];

type Slot = (typeof TICKETS)[number];

function generate(playerId: number): Modifier[] {
  const rng = new RNG(playerId);

  const points: Record<Slot, number> = {
    stat: 1,
    element: 1,
    resistance: 1,
    monster: 1,
  };
  let pool: Slot[] = [...TICKETS];

  // 25 points are allocated for the enchantment levels
  for (let i = 0; i < 25; i++) {
    const slot = rng.pickOne(pool);
    points[slot]++;
    // Resistance is capped at level 5 so if we hit it, remove from pool
    if (slot === "resistance" && points.resistance >= 5)
      pool = pool.filter((ticket) => ticket !== "resistance");
  }

  return [
    { name: `${rng.pickOne(STATS)} Percent`, value: `+${points.stat * 10}` },
    {
      name: `${rng.pickOne(ELEMENTS)} Damage`,
      value: `+${points.element * 5}`,
    },
    {
      name: `${rng.pickOne(ELEMENTS)} Resistance`,
      value: `+${points.resistance}`,
    },
    {
      name: `Damage vs. ${rng.pickOne(MONSTER_TYPES)}`,
      value: `+${points.monster * 10}`,
    },
    rng.pickOne(BONUSES),
  ];
}

export class SwordOfProceduralGeneration {
  #client: Client;

  constructor(client: Client) {
    this.#client = client;
  }

  /** Modifiers for the logged in player's sword. */
  getModifiers(): Modifier[] {
    return generate(Number(this.#client.playerId));
  }

  /** Modifiers for the sword of the specified player. */
  static getModifiers(playerId: number): Modifier[] {
    return generate(playerId);
  }
}
