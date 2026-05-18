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
  effects: z
    .record(z.string(), z.tuple([z.string(), z.coerce.number(), z.string(), z.string(), z.coerce.number()]))
    .optional()
    .default({}),
  intrinsics: z
    .record(z.string(), z.tuple([z.string(), z.string(), z.string(), z.coerce.number()]))
    .optional()
    .default({}),
});

export type ApiStatus = z.infer<typeof ApiStatusSchema>;
