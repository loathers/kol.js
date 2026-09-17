import { Effect } from "data-of-loathing";
import { beforeAll, describe, expect, test } from "vitest";

import { EffectList } from "./EffectList.js";
import { gameData } from "./GameData.js";

let ode: Effect;
let fishy: Effect;
let sparkly: Effect;

beforeAll(async () => {
  const [a, b, c] = await Promise.all([
    gameData.findEffectByName("Ode to Booze"),
    gameData.findEffectByName("Fishy"),
    gameData.findEffectByName("Sparkly!"),
  ]);
  if (!a || !b || !c) throw new Error("missing effect data");
  [ode, fishy, sparkly] = [a, b, c];
});

describe("EffectList", () => {
  test("iterates entries in the order they were added", () => {
    const list = new EffectList().add(ode, 10).add(fishy, 20).add(ode, 5);
    expect([...list].map((e) => [e.effect.name, e.duration])).toEqual([
      ["Ode to Booze", 10],
      ["Fishy", 20],
      ["Ode to Booze", 5],
    ]);
    expect(list.size).toBe(3);
  });

  test("builds from entries", () => {
    const list = new EffectList([
      { effect: fishy, duration: 3 },
      { effect: sparkly, duration: 4 },
    ]);
    expect([...list].map((e) => e.effect.name)).toEqual(["Fishy", "Sparkly!"]);
  });

  test("toMap sums durations for duplicate effects", () => {
    const list = new EffectList().add(ode, 10).add(fishy, 20).add(ode, 5);
    expect([...list.toMap()].map(([e, d]) => [e.name, d])).toEqual([
      ["Ode to Booze", 15],
      ["Fishy", 20],
    ]);
  });

  test("toMap keeps intrinsic durations infinite", () => {
    const list = new EffectList().add(ode, Infinity).add(ode, 10);
    expect(list.toMap().get(ode)).toBe(Infinity);
  });

  test("has and durationOf read across duplicates", () => {
    const list = new EffectList().add(ode, 10).add(ode, 5);
    expect(list.has(ode)).toBe(true);
    expect(list.has(fishy)).toBe(false);
    expect(list.durationOf(ode)).toBe(15);
    expect(list.durationOf(fishy)).toBe(0);
  });

  test("is empty by default", () => {
    const list = new EffectList();
    expect(list.size).toBe(0);
    expect([...list]).toEqual([]);
    expect(list.toMap().size).toBe(0);
  });
});
