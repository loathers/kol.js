/** As api.php spells them. */
export const MoonSign = {
  Mongoose: "Mongoose",
  Wallaby: "Wallaby",
  Vole: "Vole",
  Platypus: "Platypus",
  Opossum: "Opossum",
  Marmot: "Marmot",
  Wombat: "Wombat",
  Blender: "Blender",
  Packrat: "Packrat",
  BadMoon: "Bad Moon",
} as const;
export type MoonSign = (typeof MoonSign)[keyof typeof MoonSign];

const IDS: Record<MoonSign, number> = {
  [MoonSign.Mongoose]: 1,
  [MoonSign.Wallaby]: 2,
  [MoonSign.Vole]: 3,
  [MoonSign.Platypus]: 4,
  [MoonSign.Opossum]: 5,
  [MoonSign.Marmot]: 6,
  [MoonSign.Wombat]: 7,
  [MoonSign.Blender]: 8,
  [MoonSign.Packrat]: 9,
  [MoonSign.BadMoon]: 10,
};

/** The form's `whichsign` value. */
export function moonSignId(sign: MoonSign): number {
  return IDS[sign];
}

export function moonSignFromId(id: number): MoonSign | null {
  return (Object.keys(IDS) as MoonSign[]).find((s) => IDS[s] === id) ?? null;
}

const BY_NAME = new Map<string, MoonSign>(
  (Object.values(MoonSign) as MoonSign[]).map((s) => [s.toLowerCase(), s]),
);

/** No sign is spelled "None", "(none)", or nothing. */
export function toMoonSign(name: string | null | undefined): MoonSign | null {
  return BY_NAME.get(name?.trim().toLowerCase() ?? "") ?? null;
}
