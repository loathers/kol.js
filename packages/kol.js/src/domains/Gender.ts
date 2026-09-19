/** The two genders KoL's character creation offers. */
export const Gender = { Male: "Male", Female: "Female" } as const;
export type Gender = (typeof Gender)[keyof typeof Gender];

const IDS: Record<Gender, number> = {
  [Gender.Male]: 1,
  [Gender.Female]: 2,
};

/** The value the reincarnation form's `gender` select uses. */
export function genderId(gender: Gender): number {
  return IDS[gender];
}

export function genderFromId(id: number): Gender | null {
  return (Object.keys(IDS) as Gender[]).find((g) => IDS[g] === id) ?? null;
}
