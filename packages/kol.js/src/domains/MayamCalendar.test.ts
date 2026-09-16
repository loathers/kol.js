import { describe, expect, it } from "vitest";

import { MayamCalendar, getYamBatteryPool } from "./MayamCalendar.js";

describe("yam battery pool", () => {
  it("derives the frozen pool from effect data", async () => {
    const pool = await getYamBatteryPool();
    expect(pool.at(0)?.id).toBe(5);
    expect(pool.at(-1)?.id).toBe(2468);
  });

  it("keeps Fishy and drops Floundering", async () => {
    const ids = (await getYamBatteryPool()).map((e) => e.id);
    expect(ids).toContain(549);
    expect(ids).not.toContain(2218);
  });
});

describe("MayamCalendar.getYamBatteryEffects", () => {
  const roll = async (gameday: number) =>
    (await MayamCalendar.getYamBatteryEffects(gameday)).map(
      (e) => [e.duration, e.effect.name] as const,
    );

  it("pairs each effect with its duration", async () => {
    await expect(roll(8619)).resolves.toEqual([
      [10, "Piratey Flavor"],
      [20, "Make Meat FA$T!"],
      [30, "Thaumodynamic"],
    ]);
  });

  it("rolls three effects for a day", async () => {
    await expect(roll(8604)).resolves.toEqual([
      [10, "Buggy Flavor"],
      [20, "Celestial Body"],
      [30, "Human-Fish Hybrid"],
    ]);
  });

  it("matches the dump for later days", async () => {
    await expect(roll(8654)).resolves.toEqual([
      [10, "Cold as Ice"],
      [20, "Space Tripping"],
      [30, "Dwarven Hardiness"],
    ]);
  });
});
