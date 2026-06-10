import { POSITIONAL_GROUPS, RANGE_PAIRS, getModifierDef } from "./catalog.js";
import { evaluate } from "./expressions.js";
import { parseModifiers } from "./parser.js";
import type {
  EvaluatedModifier,
  ExpressionContext,
  ModifierSource,
  ParsedModifier,
} from "./types.js";

export type DRTier = { upTo: number; ratio: number };

export function applyDR(raw: number, tiers: DRTier[]): number {
  const sign = raw < 0 ? -1 : 1;
  let remaining = Math.abs(raw);
  let effective = 0;
  let prev = 0;

  for (const tier of tiers) {
    if (remaining <= 0) break;
    const width = tier.upTo - prev;
    const chunk = Math.min(remaining, width);
    if (tier.ratio === Infinity) break;
    effective += chunk / tier.ratio;
    remaining -= chunk;
    prev = tier.upTo;
  }

  return sign * effective;
}

type EvaluatedBooleanModifier = Extract<EvaluatedModifier, { kind: "boolean" }>;
type EvaluatedStringModifier = Extract<EvaluatedModifier, { kind: "string" }>;
type EvaluatedNumericModifier = Extract<EvaluatedModifier, { kind: "numeric" }>;

function evaluateModifier(
  pm: Extract<ParsedModifier, { kind: "boolean" }>,
  context: ExpressionContext,
): EvaluatedBooleanModifier;
function evaluateModifier(
  pm: Extract<ParsedModifier, { kind: "string" }>,
  context: ExpressionContext,
): EvaluatedStringModifier;
function evaluateModifier(
  pm: Extract<ParsedModifier, { kind: "numeric" }>,
  context: ExpressionContext,
): EvaluatedNumericModifier | EvaluatedBooleanModifier;
function evaluateModifier(
  pm: Extract<ParsedModifier, { kind: "expression" }>,
  context: ExpressionContext,
):
  | EvaluatedNumericModifier
  | EvaluatedBooleanModifier
  | EvaluatedStringModifier;
function evaluateModifier(
  pm: ParsedModifier,
  context: ExpressionContext,
): EvaluatedModifier {
  const def = getModifierDef(pm.name);

  const value =
    pm.kind === "expression" ? evaluate(pm.expr, context) : pm.value;

  switch (def.kind) {
    case "boolean":
      return { kind: "boolean", name: pm.name, value: Boolean(value) };
    case "string":
      return { kind: "string", name: pm.name, value: String(value) };
    case "numeric":
    default:
      return { kind: "numeric", name: pm.name, value: Number(value) };
  }
}

type OrderedEntry = { groupIndex: number; value: string | number };

const RANGE_NAMES = new Set(RANGE_PAIRS.flatMap((r) => [r.min, r.max]));
const POSITIONAL_NAMES = new Set(
  POSITIONAL_GROUPS.flatMap((g) => [g.primary, g.secondary]),
);

export function resolveModifiers(
  sources: ModifierSource[],
  context: ExpressionContext,
): Map<string, EvaluatedModifier> {
  const { buckets, ordered } = collectEvaluated(sources, context);
  const result = new Map<string, EvaluatedModifier>();

  aggregateStandard(buckets, result);
  aggregateRangePairs(ordered, result);
  aggregatePositionalGroups(ordered, result);
  aggregateCollected(ordered, result);

  return result;
}

function collectEvaluated(
  sources: ModifierSource[],
  context: ExpressionContext,
): {
  buckets: Map<string, EvaluatedModifier[]>;
  ordered: Map<string, OrderedEntry[]>;
} {
  const buckets = new Map<string, EvaluatedModifier[]>();
  const ordered = new Map<string, OrderedEntry[]>();

  function record(name: string, evaluated: EvaluatedModifier): void {
    if (!buckets.has(name)) buckets.set(name, []);
    buckets.get(name)!.push(evaluated);
  }

  function recordOrdered(
    name: string,
    groupIndex: number,
    value: string | number,
  ): void {
    if (!ordered.has(name)) ordered.set(name, []);
    ordered.get(name)!.push({ groupIndex, value });
  }

  for (const source of sources) {
    for (const pm of parseModifiers(source.modifiers)) {
      if (pm.kind === "boolean") {
        record(pm.name, evaluateModifier(pm, context));
      } else if (pm.kind === "string") {
        const evaluated = evaluateModifier(pm, context);
        record(pm.name, evaluated);
        recordOrdered(pm.name, pm.groupIndex, evaluated.value);
      } else if (pm.kind === "numeric") {
        const evaluated = evaluateModifier(pm, context);
        record(pm.name, evaluated);
        if (evaluated.kind === "numeric") {
          recordOrdered(pm.name, pm.groupIndex, evaluated.value);
        }
      } else {
        const evaluated = evaluateModifier(pm, context);
        record(pm.name, evaluated);
        if (evaluated.kind !== "boolean") {
          recordOrdered(pm.name, pm.groupIndex, evaluated.value);
        }
      }
    }
  }

  return { buckets, ordered };
}

function aggregateStandard(
  buckets: Map<string, EvaluatedModifier[]>,
  result: Map<string, EvaluatedModifier>,
): void {
  for (const [name, values] of buckets) {
    if (RANGE_NAMES.has(name) || POSITIONAL_NAMES.has(name)) continue;
    const def = getModifierDef(name);
    if (def.aggregation === "collect") continue;

    const aggregated = aggregate(name, values, def.aggregation);
    if (aggregated === null) continue;

    result.set(
      name,
      aggregated.kind === "numeric" && def.diminishingReturns
        ? {
            ...aggregated,
            value: applyDR(aggregated.value, def.diminishingReturns),
          }
        : aggregated,
    );
  }
}

function aggregateRangePairs(
  ordered: Map<string, OrderedEntry[]>,
  result: Map<string, EvaluatedModifier>,
): void {
  for (const { min, max, resultName } of RANGE_PAIRS) {
    const minEntries = ordered.get(min);
    const maxEntries = ordered.get(max);
    if (!minEntries?.length && !maxEntries?.length) continue;

    result.set(resultName, {
      kind: "range",
      name: resultName,
      min: (minEntries ?? []).reduce((a, e) => a + Number(e.value), 0),
      max: (maxEntries ?? []).reduce((a, e) => a + Number(e.value), 0),
    });
  }
}

function aggregatePositionalGroups(
  ordered: Map<string, OrderedEntry[]>,
  result: Map<string, EvaluatedModifier>,
): void {
  for (const { primary, secondary } of POSITIONAL_GROUPS) {
    const effects = ordered.get(primary);
    if (!effects?.length) continue;

    const durations = ordered.get(secondary) ?? [];
    result.set(primary, {
      kind: "effect-grants",
      name: primary,
      grants: effects.map((e, i) => ({
        effect: String(e.value),
        duration: Number(durations[i]?.value ?? 0),
      })),
    });
  }
}

function aggregateCollected(
  ordered: Map<string, OrderedEntry[]>,
  result: Map<string, EvaluatedModifier>,
): void {
  for (const [name, entries] of ordered) {
    if (POSITIONAL_NAMES.has(name) || RANGE_NAMES.has(name)) continue;
    if (getModifierDef(name).aggregation !== "collect") continue;
    result.set(name, {
      kind: "string[]",
      name,
      values: entries.map((e) => String(e.value)),
    });
  }
}

function aggregate(
  name: string,
  values: EvaluatedModifier[],
  aggregation: string,
): EvaluatedModifier | null {
  if (values.length === 0) return null;

  if (aggregation === "override") return values[values.length - 1];

  const first = values[0];

  if (first.kind === "boolean") {
    return {
      kind: "boolean",
      name,
      value: values.some((v) => v.kind === "boolean" && v.value),
    };
  }

  if (first.kind === "string") return values[values.length - 1];

  const nums = values.filter(
    (v): v is EvaluatedNumericModifier => v.kind === "numeric",
  );
  if (nums.length === 0) return null;

  if (aggregation === "additive") {
    return {
      kind: "numeric",
      name,
      value: nums.reduce((acc, v) => acc + v.value, 0),
    };
  }
  if (aggregation === "min") {
    return {
      kind: "numeric",
      name,
      value: nums.reduce((acc, v) => Math.min(acc, v.value), Infinity),
    };
  }
  if (aggregation === "max") {
    return {
      kind: "numeric",
      name,
      value: nums.reduce((acc, v) => Math.max(acc, v.value), -Infinity),
    };
  }

  return null;
}
