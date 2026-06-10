import type { Modifier } from "data-of-loathing";

import { getModifierDef } from "./catalog.js";
import type { ParsedModifier } from "./types.js";

const BRACKET_EXPR = /^\[(.+)\]$/;
const BRACKET_ID = /^\[(\d+)\](.+)$/;
const QUOTED_STRING = /^"(.*)"$/s;

export function parseModifiers(entries: Modifier[]): ParsedModifier[] {
  const occurrences = new Map<string, number>();
  const results: ParsedModifier[] = [];

  for (const { name, value } of entries) {
    const groupIndex = occurrences.get(name) ?? 0;
    occurrences.set(name, groupIndex + 1);
    results.push(parseEntry(name, value, groupIndex));
  }

  return results;
}

function parseEntry(
  name: string,
  value: string,
  groupIndex: number,
): ParsedModifier {
  const def = getModifierDef(name);

  // Expressions can represent any def.kind — check before dispatching on def.kind
  const exprMatch = value.match(BRACKET_EXPR);
  if (exprMatch) {
    return { kind: "expression", name, groupIndex, expr: exprMatch[1] };
  }

  // def.kind drives the output kind, guaranteeing pm.kind aligns with def.kind
  switch (def.kind) {
    case "string": {
      const quotedMatch = value.match(QUOTED_STRING);
      const unquoted = quotedMatch ? quotedMatch[1] : value;
      const idMatch = unquoted.match(BRACKET_ID);
      return {
        kind: "string",
        name,
        groupIndex,
        value: idMatch ? idMatch[2].trim() : unquoted,
      };
    }
    case "boolean":
      return { kind: "boolean", name, value: true };
    case "numeric":
    default:
      return { kind: "numeric", name, groupIndex, value: parseFloat(value) };
  }
}
