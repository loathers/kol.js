import type { Location, Modifier, Path } from "data-of-loathing";

import type { EquipmentMap } from "../domains/Equipment.js";

export type { Modifier };

export type ParsedModifier =
  | { kind: "numeric"; name: string; groupIndex: number; value: number }
  | { kind: "expression"; name: string; groupIndex: number; expr: string }
  | { kind: "boolean"; name: string; value: true }
  | { kind: "string"; name: string; groupIndex: number; value: string };

export type ExpressionContext = {
  variables?: Record<string, number>;
  prefs: Record<string, string | number>;
  skills: Set<string>;
  equipment: EquipmentMap;
  location?: Location;
  path?: Path;
  strict?: boolean;
};

export type EvaluatedModifier =
  | { kind: "numeric"; name: string; value: number }
  | { kind: "boolean"; name: string; value: boolean }
  | { kind: "string"; name: string; value: string }
  | { kind: "string[]"; name: string; values: string[] }
  | {
      kind: "effect-grants";
      name: string;
      grants: Array<{ effect: string; duration: number }>;
    }
  | { kind: "range"; name: string; min: number; max: number };

export type ModifierSource = {
  label: string;
  modifiers: Modifier[];
};
