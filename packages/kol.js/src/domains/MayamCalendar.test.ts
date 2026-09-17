import { describe, expect, it } from "vitest";

import { gameData } from "../GameData.js";
import { MayamCalendar } from "./MayamCalendar.js";

describe("yam battery pool", () => {
  it("derives the frozen pool from effect data", async () => {
    const pool = await gameData.getGoodEffects(2468);
    expect(pool.at(0)?.id).toBe(5);
    expect(pool.at(-1)?.id).toBe(2468);
  });

  it("keeps Fishy", async () => {
    const ids = (await gameData.getGoodEffects(2468)).map((e) => e.id);
    expect(ids).toContain(549);
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
      [10, "Hippy Flavor"],
      [20, "Celestial Body"],
      [30, "Human-Goblin Hybrid"],
    ]);
  });

  it("matches the dump for 8621", async () => {
    await expect(roll(8621)).resolves.toEqual([
      [10, "Healthy, Elfy, and Wise"],
      [20, "Preternatural Greed"],
      [30, "The Q Is Talking To You"],
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
