import { describe, expect, test } from "vitest";

import { gameData } from "../GameData.js";
import { applyDR, resolveModifiers } from "./resolver.js";
import type { ExpressionContext } from "./types.js";

const baseContext: ExpressionContext = {
  variables: { L: 10 },
  prefs: {},
  skills: new Set(),
  equipment: new Map(),
};

describe("applyDR", () => {
  const tiers = [{ upTo: 25, ratio: 1 }, { upTo: 75, ratio: 5 }, { upTo: Infinity, ratio: Infinity }];

  test("within first tier: 1:1", () => {
    expect(applyDR(10, tiers)).toBe(10);
    expect(applyDR(25, tiers)).toBe(25);
  });

  test("spanning first and second tier", () => {
    // 25 @ 1:1 + 5 @ 5:1 = 25 + 1 = 26
    expect(applyDR(30, tiers)).toBe(26);
  });

  test("at the cap of second tier: 25 + 10 = 35", () => {
    // 25 @ 1:1 + 50 @ 5:1 = 25 + 10 = 35
    expect(applyDR(75, tiers)).toBe(35);
  });

  test("beyond cap: no additional gain", () => {
    expect(applyDR(100, tiers)).toBe(35);
    expect(applyDR(1000, tiers)).toBe(35);
  });

  test("negative values mirror positive", () => {
    expect(applyDR(-30, tiers)).toBe(-26);
    expect(applyDR(-75, tiers)).toBe(-35);
    expect(applyDR(-100, tiers)).toBe(-35);
  });

  test("zero", () => {
    expect(applyDR(0, tiers)).toBe(0);
  });

  test("no tiers: identity", () => {
    expect(applyDR(50, [])).toBe(0);
  });
});

describe("resolveModifiers (integration)", () => {
  test("numeric modifiers from real item data", async () => {
    const modifierMap = await gameData.findModifiersForItemIds([3]);
    const helmetMods = modifierMap.get(3);
    expect(helmetMods).toBeDefined();

    const result = resolveModifiers(
      [{ label: "hat: helmet turtle", modifiers: helmetMods! }],
      baseContext,
    );

    expect(result.get("Muscle")).toMatchObject({ kind: "numeric", value: 1 });
  });

  test("Effect as effect-grants with single grant", async () => {
    // seal tooth (id: 2): Effect "Bloody Hand", Effect Duration 3
    const modifierMap = await gameData.findModifiersForItemIds([2]);
    const sealMods = modifierMap.get(2);
    expect(sealMods).toBeDefined();

    const result = resolveModifiers(
      [{ label: "weapon: seal tooth", modifiers: sealMods! }],
      baseContext,
    );

    expect(result.get("Effect")).toMatchObject({
      kind: "effect-grants",
      grants: [{ effect: "Bloody Hand", duration: 3 }],
    });
    expect(result.has("Effect Duration")).toBe(false);
  });

  test("additive aggregation across multiple sources", async () => {
    const modifierMap = await gameData.findModifiersForItemIds([3]);
    const mods = modifierMap.get(3)!;

    const result = resolveModifiers(
      [
        { label: "hat: helmet turtle", modifiers: mods },
        { label: "offhand: helmet turtle copy", modifiers: mods },
      ],
      baseContext,
    );

    expect(result.get("Muscle")).toMatchObject({ kind: "numeric", value: 2 });
  });

  test("HP Regen as range from real item data", async () => {
    // hamethyst ring (id: 714): HP Regen Min 2, HP Regen Max 4
    const modifierMap = await gameData.findModifiersForItemIds([714]);
    const ringMods = modifierMap.get(714);
    expect(ringMods).toBeDefined();

    const result = resolveModifiers(
      [{ label: "acc: hamethyst ring", modifiers: ringMods! }],
      baseContext,
    );

    expect(result.get("HP Regen")).toMatchObject({ kind: "range", min: 2, max: 4 });
    expect(ringMods).toBeDefined();
    expect(result.has("HP Regen Min")).toBe(false);
    expect(result.has("HP Regen Max")).toBe(false);
  });

  test("HP Regen range aggregated across sources", () => {
    const result = resolveModifiers(
      [
        { label: "item1", modifiers: [{ name: "HP Regen Min", value: "2" }, { name: "HP Regen Max", value: "4" }] },
        { label: "item2", modifiers: [{ name: "HP Regen Min", value: "3" }, { name: "HP Regen Max", value: "6" }] },
      ],
      baseContext,
    );

    expect(result.get("HP Regen")).toMatchObject({ kind: "range", min: 5, max: 10 });
  });

  test("effect modifier from real effect data", async () => {
    const modifierMap = await gameData.findModifiersForEffectIds([2]);
    const sleepyMods = modifierMap.get(2);
    expect(sleepyMods).toBeDefined();

    const result = resolveModifiers(
      [{ label: "effect: Sleepy", modifiers: sleepyMods! }],
      baseContext,
    );

    expect(result.get("Muscle Percent")).toMatchObject({ kind: "numeric", value: -30 });
  });

  test("boolean flag modifier", () => {
    const result = resolveModifiers(
      [{ label: "test", modifiers: [{ name: "Single Equip", value: "true" }, { name: "Never Fumble", value: "true" }] }],
      baseContext,
    );

    expect(result.get("Single Equip")).toMatchObject({ kind: "boolean", value: true });
    expect(result.get("Never Fumble")).toMatchObject({ kind: "boolean", value: true });
  });

  test("Combat Rate DR tiers applied", () => {
    const result = resolveModifiers(
      [{ label: "test", modifiers: [{ name: "Combat Rate", value: "30" }] }],
      baseContext,
    );
    expect(result.get("Combat Rate")).toMatchObject({ kind: "numeric", value: 26 });
  });

  test("Combat Rate DR: negative direction", () => {
    const result = resolveModifiers(
      [{ label: "test", modifiers: [{ name: "Combat Rate", value: "-30" }] }],
      baseContext,
    );
    expect(result.get("Combat Rate")).toMatchObject({ kind: "numeric", value: -26 });
  });

  test("Combat Rate DR: beyond cap returns capped value", () => {
    const result = resolveModifiers(
      [{ label: "test", modifiers: [{ name: "Combat Rate", value: "100" }] }],
      baseContext,
    );
    expect(result.get("Combat Rate")).toMatchObject({ kind: "numeric", value: 35 });
  });

  test("collect aggregation produces string[] for Conditional Skill", () => {
    const result = resolveModifiers(
      [{
        label: "sweat pants",
        modifiers: [
          { name: "Conditional Skill (Equipped)", value: '"Sip Some Sweat"' },
          { name: "Conditional Skill (Inventory)", value: '"Sweat Out Some Booze"' },
        ],
      }],
      baseContext,
    );

    expect(result.get("Conditional Skill (Equipped)")).toMatchObject({
      kind: "string[]",
      values: ["Sip Some Sweat"],
    });
    expect(result.get("Conditional Skill (Inventory)")).toMatchObject({
      kind: "string[]",
      values: ["Sweat Out Some Booze"],
    });
  });

  test("collect aggregation accumulates across multiple sources", () => {
    const result = resolveModifiers(
      [
        { label: "item1", modifiers: [{ name: "Skill", value: '"Thrust-Smack"' }] },
        { label: "item2", modifiers: [{ name: "Skill", value: '"Lunging Thrust-Smack"' }] },
      ],
      baseContext,
    );

    expect(result.get("Skill")).toMatchObject({
      kind: "string[]",
      values: ["Thrust-Smack", "Lunging Thrust-Smack"],
    });
  });

  test("empty sources returns empty map", () => {
    expect(resolveModifiers([], baseContext).size).toBe(0);
  });

  test("positional group with no secondary uses duration 0", () => {
    const result = resolveModifiers(
      [{ label: "orphaned effect", modifiers: [{ name: "Effect", value: '"Bugged"' }] }],
      baseContext,
    );
    expect(result.get("Effect")).toMatchObject({
      kind: "effect-grants",
      grants: [{ effect: "Bugged", duration: 0 }],
    });
  });

  test("multi-occurrence effect grants (synthetic data)", () => {
    const result = resolveModifiers(
      [{
        label: "cup of sugar",
        modifiers: [
          { name: "Effect", value: '"Sugar Rush"' },
          { name: "Effect Duration", value: "10" },
          { name: "Effect", value: '"Sweet Talkin\'"' },
          { name: "Effect Duration", value: "100" },
        ],
      }],
      baseContext,
    );

    expect(result.get("Effect")).toMatchObject({
      kind: "effect-grants",
      grants: [
        { effect: "Sugar Rush", duration: 10 },
        { effect: "Sweet Talkin'", duration: 100 },
      ],
    });
    expect(result.has("Effect Duration")).toBe(false);
  });
});
