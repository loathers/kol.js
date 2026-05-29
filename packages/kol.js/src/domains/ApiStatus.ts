import { z } from "zod";

export const ApiStatusSchema = z.object({
  playerid: z.string(),
  pwd: z.string(),
  hardcore: z.string().transform((v) => v === "1"),
  ascensions: z.coerce.number(),
  turnsplayed: z.coerce.number(),
  daynumber: z.coerce.number(),
  level: z.coerce.number(),
  roninleft: z.coerce.number(),
  path: z.coerce.number(),
  sign: z.string(),
  adventures: z.coerce.number(),
  class: z.coerce.number(),
  hp: z.coerce.number(),
  maxhp: z.coerce.number(),
  mp: z.coerce.number(),
  maxmp: z.coerce.number(),
  equipment: z
    .object({
      hat: z.coerce.number().default(0),
      shirt: z.coerce.number().default(0),
      pants: z.coerce.number().default(0),
      weapon: z.coerce.number().default(0),
      offhand: z.coerce.number().default(0),
      acc1: z.coerce.number().default(0),
      acc2: z.coerce.number().default(0),
      acc3: z.coerce.number().default(0),
      container: z.coerce.number().default(0),
      cardsleeve: z.coerce.number().default(0),
    })
    .optional(),
  stickers: z.array(z.coerce.number()).default(() => []),
  folder_holder: z.array(z.coerce.number()).default(() => []),
  effects: z
    .record(z.string(), z.tuple([z.string(), z.coerce.number(), z.string(), z.string(), z.coerce.number()]))
    .optional()
    .default({}),
  intrinsics: z
    .record(z.string(), z.tuple([z.string(), z.string(), z.string(), z.coerce.number()]))
    .optional()
    .default({}),
  familiarexp: z.coerce.number().optional(),
  lastadv: z
    .object({
      id: z.coerce.number(),
      name: z.string(),
    })
    .optional(),
});

export type ApiStatus = z.infer<typeof ApiStatusSchema>;
