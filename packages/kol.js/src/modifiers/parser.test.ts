import { describe, expect, test } from "vitest";

import { parseModifiers } from "./parser.js";

describe("parseModifiers", () => {
  test("numeric values", () => {
    const result = parseModifiers([
      { name: "Muscle", value: "+5" },
      { name: "Moxie", value: "-3" },
      { name: "Maximum HP", value: "10" },
    ]);
    expect(result).toContainEqual({
      kind: "numeric",
      name: "Muscle",
      groupIndex: 0,
      value: 5,
    });
    expect(result).toContainEqual({
      kind: "numeric",
      name: "Moxie",
      groupIndex: 0,
      value: -3,
    });
    expect(result).toContainEqual({
      kind: "numeric",
      name: "Maximum HP",
      groupIndex: 0,
      value: 10,
    });
  });

  test("boolean flag", () => {
    const result = parseModifiers([
      { name: "Single Equip", value: "true" },
      { name: "Never Fumble", value: "true" },
    ]);
    expect(result).toContainEqual({
      kind: "boolean",
      name: "Single Equip",
      value: true,
    });
    expect(result).toContainEqual({
      kind: "boolean",
      name: "Never Fumble",
      value: true,
    });
  });

  test("expression values", () => {
    const result = parseModifiers([
      { name: "Moxie", value: "[7*(1+skill(Accordion Appreciation))]" },
      { name: "HP Regen Min", value: "[floor(L/2)+1]" },
    ]);
    expect(result).toContainEqual({
      kind: "expression",
      name: "Moxie",
      groupIndex: 0,
      expr: "7*(1+skill(Accordion Appreciation))",
    });
    expect(result).toContainEqual({
      kind: "expression",
      name: "HP Regen Min",
      groupIndex: 0,
      expr: "floor(L/2)+1",
    });
  });

  test("quoted string values", () => {
    const result = parseModifiers([
      { name: "Effect", value: '"Bloody Hand"' },
      { name: "Class", value: '"Seal Clubber"' },
    ]);
    expect(result).toContainEqual({
      kind: "string",
      name: "Effect",
      groupIndex: 0,
      value: "Bloody Hand",
    });
    expect(result).toContainEqual({
      kind: "string",
      name: "Class",
      groupIndex: 0,
      value: "Seal Clubber",
    });
  });

  test("ID+name combo for Effect", () => {
    const result = parseModifiers([
      { name: "Effect", value: '"[599]A Little Bit Evil"' },
    ]);
    expect(result).toContainEqual({
      kind: "string",
      name: "Effect",
      groupIndex: 0,
      value: "A Little Bit Evil",
    });
  });

  test("familiar effect string", () => {
    const result = parseModifiers([
      { name: "Familiar Effect", value: '"atk, cap 2"' },
    ]);
    expect(result).toContainEqual({
      kind: "string",
      name: "Familiar Effect",
      groupIndex: 0,
      value: "atk, cap 2",
    });
  });

  test("real item: seal tooth", () => {
    const result = parseModifiers([
      { name: "Effect", value: '"Bloody Hand"' },
      { name: "Effect Duration", value: "3" },
    ]);
    expect(result).toContainEqual({
      kind: "string",
      name: "Effect",
      groupIndex: 0,
      value: "Bloody Hand",
    });
    expect(result).toContainEqual({
      kind: "numeric",
      name: "Effect Duration",
      groupIndex: 0,
      value: 3,
    });
  });

  test("real item: hamethyst ring", () => {
    const result = parseModifiers([
      { name: "Muscle", value: "+5" },
      { name: "Maximum HP", value: "+10" },
      { name: "HP Regen Min", value: "2" },
      { name: "HP Regen Max", value: "4" },
      { name: "Single Equip", value: "true" },
    ]);
    expect(result).toHaveLength(5);
    expect(result).toContainEqual({
      kind: "numeric",
      name: "Muscle",
      groupIndex: 0,
      value: 5,
    });
    expect(result).toContainEqual({
      kind: "boolean",
      name: "Single Equip",
      value: true,
    });
  });

  test("def.kind drives output kind: boolean catalog entry always yields boolean", () => {
    // "Never Fumble" has def.kind === "boolean" — value "true" should parse as boolean
    const result = parseModifiers([{ name: "Never Fumble", value: "true" }]);
    expect(result[0].kind).toBe("boolean");

    // An expression for a boolean-catalog modifier should parse as expression (not boolean)
    const expr = parseModifiers([
      { name: "Free Pull", value: "[path(Avatar of Boris)]" },
    ]);
    expect(expr[0]).toMatchObject({
      kind: "expression",
      expr: "path(Avatar of Boris)",
    });
  });

  test("def.kind drives output kind: unknown modifier is stringified", () => {
    const result = parseModifiers([
      { name: "Completely Unknown Modifier", value: "42" },
    ]);
    expect(result[0]).toMatchObject({ kind: "string", value: "42" });
  });

  test("groupIndex increments for repeated names", () => {
    const result = parseModifiers([
      { name: "Effect", value: '"Sugar Rush"' },
      { name: "Effect Duration", value: "10" },
      { name: "Effect", value: '"Sweet Talkin\'"' },
      { name: "Effect Duration", value: "100" },
    ]);
    expect(result).toContainEqual({
      kind: "string",
      name: "Effect",
      groupIndex: 0,
      value: "Sugar Rush",
    });
    expect(result).toContainEqual({
      kind: "string",
      name: "Effect",
      groupIndex: 1,
      value: "Sweet Talkin'",
    });
    expect(result).toContainEqual({
      kind: "numeric",
      name: "Effect Duration",
      groupIndex: 0,
      value: 10,
    });
    expect(result).toContainEqual({
      kind: "numeric",
      name: "Effect Duration",
      groupIndex: 1,
      value: 100,
    });
  });
});
