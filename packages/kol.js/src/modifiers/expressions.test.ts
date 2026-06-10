import { Item, Location, Path } from "data-of-loathing";
import { beforeAll, describe, expect, test } from "vitest";

import { gameData } from "../GameData.js";
import { evaluate } from "./expressions.js";
import type { ExpressionContext } from "./types.js";

let ctx: ExpressionContext;

beforeAll(async () => {
  await gameData.load();
  const helmetTurtle = await gameData.query.findOne(Item, { id: 3 }); // helmet turtle
  ctx = {
    variables: { L: 10, M: 4, G: 3, H: 0, F: 25 },
    prefs: {
      yearbookCameraUpgrades: 12,
      _stinkyCheeseCount: 15,
      _saberMod: 3,
      locketPhylum: "demon",
    },
    skills: new Set(["Accordion Appreciation"]),
    equipment: new Map([["hat", helmetTurtle!]]),
    strict: true,
  };
});

describe("evaluate", () => {
  test("arithmetic", () => {
    expect(evaluate("2+3", ctx)).toBe(5);
    expect(evaluate("10-4", ctx)).toBe(6);
    expect(evaluate("3*4", ctx)).toBe(12);
    expect(evaluate("10/4", ctx)).toBe(2.5);
    expect(evaluate("2^10", ctx)).toBe(1024);
  });

  test("unary minus", () => {
    expect(evaluate("-5", ctx)).toBe(-5);
    expect(evaluate("-L", ctx)).toBe(-10);
  });

  test("variables", () => {
    expect(evaluate("L", ctx)).toBe(10);
    expect(evaluate("M", ctx)).toBe(4);
    expect(evaluate("G", ctx)).toBe(3);
    expect(evaluate("H", ctx)).toBe(0);
    expect(evaluate("F", ctx)).toBe(25);
  });

  test("unknown variable returns 0 in non-strict mode", () => {
    expect(evaluate("X", { ...ctx, variables: {}, strict: false })).toBe(0);
  });

  test("unknown variable throws in strict mode", () => {
    expect(() => evaluate("X", { ...ctx, variables: {} })).toThrow();
  });

  test("math functions", () => {
    expect(evaluate("floor(L/2)+1", ctx)).toBe(6);
    expect(evaluate("ceil(1.1)", ctx)).toBe(2);
    expect(evaluate("min(2*L,30)", ctx)).toBe(20);
    expect(evaluate("max(100,30)", ctx)).toBe(100);
    expect(evaluate("lte(5,10)", ctx)).toBe(1);
    expect(evaluate("gte(10,5)", ctx)).toBe(1);
    expect(evaluate("lte(10,5)", ctx)).toBe(0);
  });

  test("power and complex expressions", () => {
    expect(evaluate("L^1.2", ctx)).toBeCloseTo(Math.pow(10, 1.2));
    expect(evaluate("15+5*M", ctx)).toBe(35);
    expect(evaluate("10*G", ctx)).toBe(30);
    expect(evaluate("floor(L/2)+1", ctx)).toBe(6);
    expect(evaluate("min(2*L,30)", ctx)).toBe(20);
  });

  test("skill function", () => {
    expect(evaluate("7*(1+skill(Accordion Appreciation))", ctx)).toBe(14);
    expect(evaluate("skill(Unknown Skill)", ctx)).toBe(0);
  });

  test("equipped function", () => {
    expect(evaluate("equipped(helmet turtle)", ctx)).toBe(1);
    expect(evaluate("equipped(nonexistent item)", ctx)).toBe(0);
  });

  test("unarmed", async () => {
    const sealTooth = await gameData.query.findOne(Item, { id: 2 }); // seal tooth (weapon)
    const noWeapon: ExpressionContext = { ...ctx, equipment: new Map() };
    const withWeapon: ExpressionContext = {
      ...ctx,
      equipment: new Map([["weapon", sealTooth!]]),
    };
    expect(evaluate("unarmed", noWeapon)).toBe(1);
    expect(evaluate("unarmed", withWeapon)).toBe(0);
    expect(evaluate("3*unarmed", noWeapon)).toBe(3);
  });

  test("zone/loc/env/path functions", async () => {
    await gameData.load();
    const location = await gameData.query.findOne(Location, { id: 166 }); // A Maze of Sewer Tunnels
    const path = await gameData.query.findOne(Path, { id: 8 }); // Avatar of Boris
    const locCtx: ExpressionContext = {
      ...ctx,
      location: location ?? undefined,
      path: path ?? undefined,
    };

    expect(evaluate("zone(Hobopolis)", locCtx)).toBe(1);
    expect(evaluate("zone(Other Zone)", locCtx)).toBe(0);
    expect(evaluate("loc(A Maze of Sewer Tunnels)", locCtx)).toBe(1);
    expect(evaluate("env(underground)", locCtx)).toBe(1);
    expect(evaluate("path(Avatar of Boris)", locCtx)).toBe(1);
    expect(evaluate("path(Heavy Rains)", locCtx)).toBe(0);
  });

  test("pref single arg", () => {
    expect(evaluate("pref(yearbookCameraUpgrades)-9", ctx)).toBe(3);
    expect(evaluate("pref(_stinkyCheeseCount)", ctx)).toBe(15);
  });

  test("pref match form", () => {
    expect(evaluate("pref(locketPhylum,demon)", ctx)).toBe(1);
    expect(evaluate("pref(locketPhylum,beast)", ctx)).toBe(0);
    expect(evaluate("pref(_saberMod,3)", ctx)).toBe(1);
    expect(evaluate("pref(_saberMod,1)", ctx)).toBe(0);
  });

  test("nested functions", () => {
    expect(
      evaluate("max(1,min(33,floor(pref(_stinkyCheeseCount)/3)))", ctx),
    ).toBe(5);
    expect(
      evaluate("20*max(min(pref(yearbookCameraUpgrades)-9,1),0)", ctx),
    ).toBe(20);
  });

  test("parentheses", () => {
    expect(evaluate("(2+3)*4", ctx)).toBe(20);
    expect(evaluate("2*(3+4)", ctx)).toBe(14);
  });

  test("from real item data", () => {
    expect(evaluate("1+3*pref(_saberMod,3)", ctx)).toBe(4);
  });

  test("positive unary prefix in expression", () => {
    // [+1*D] — D unknown, but the leading + should not trip the parser
    expect(evaluate("+1*L", ctx)).toBe(10);
    expect(evaluate("+2+3", ctx)).toBe(5);
  });

  test("complex real expressions with unknown variables fall back to 0", () => {
    const lax = { ...ctx, strict: false };
    // [4.5+1.5*X] — X unknown
    expect(evaluate("4.5+1.5*X", lax)).toBe(4.5);
    // [+1*D] — D unknown
    expect(evaluate("+1*D", lax)).toBe(0);
    // [L^1.2] with level 10
    expect(evaluate("L^1.2", ctx)).toBeCloseTo(Math.pow(10, 1.2));
    // [2*lte(paradoxicity,21)*gte(paradoxicity,17)] — paradoxicity is a multi-letter variable
    expect(
      evaluate("2*lte(paradoxicity,21)*gte(paradoxicity,17)", {
        ...ctx,
        variables: { ...ctx.variables, paradoxicity: 18 },
      }),
    ).toBe(2);
    expect(
      evaluate("2*lte(paradoxicity,21)*gte(paradoxicity,17)", {
        ...ctx,
        variables: { ...ctx.variables, paradoxicity: 25 },
      }),
    ).toBe(0);
  });
});
