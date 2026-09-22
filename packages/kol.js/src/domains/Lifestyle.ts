/** As ascensionhistory.php spells it. */
export const Lifestyle = {
  Casual: "CASUAL",
  Softcore: "SOFTCORE",
  Hardcore: "HARDCORE",
} as const;
export type Lifestyle = (typeof Lifestyle)[keyof typeof Lifestyle];

const IDS: Record<Lifestyle, number> = {
  [Lifestyle.Casual]: 1,
  [Lifestyle.Softcore]: 2,
  [Lifestyle.Hardcore]: 3,
};

/** The form's `asctype` value. */
export function lifestyleId(lifestyle: Lifestyle): number {
  return IDS[lifestyle];
}

export function lifestyleFromId(id: number): Lifestyle | null {
  return (Object.keys(IDS) as Lifestyle[]).find((l) => IDS[l] === id) ?? null;
}
