import { decodeHTML } from "entities";

import type { Client } from "../Client.js";

/**
 * fight.php, a round at a time.
 *
 * A single up-front macro settles a whole fight in one request, which is cheap
 * but blind: it cannot react to the monster, to a skill running out, or to
 * losing. Submitting one round at a time lets a caller actually fight.
 *
 * Each round still goes as a macro, because that is the form KoL accepts
 * uniformly for attacking, casting and using items.
 */

export type FightAction =
  | { kind: "attack"; label: string }
  | { kind: "skill"; id: number; label: string }
  | { kind: "item"; id: number; label: string }
  | { kind: "runaway"; label: string };

export type FightState =
  | {
      status: "ongoing";
      monster: string;
      /** The game's own prose for what just happened. */
      text: string;
      actions: FightAction[];
    }
  | { status: "won" | "lost" | "ended"; text: string };

const WON =
  /You win the fight|Victory!|You acquire|You gain \d+ (Meat|Adventure)/i;
const LOST =
  /You lose\.|beaten up|You're on your way to the Sewer|defeated!|That's a shame/i;

/** One action, as a macro KoL will run for a single round. */
export function actionToMacro(action: FightAction): string {
  switch (action.kind) {
    case "attack":
      return "attack;";
    case "skill":
      return `skill ${action.id};`;
    case "item":
      return `use ${action.id};`;
    case "runaway":
      return "runaway;";
  }
}

/**
 * The game's account of the round.
 *
 * Not truncated: the round's most decision-relevant sentence is often the last
 * one — whether the attack landed, whether it bounced off harmlessly, what the
 * familiar did, what dropped.
 */
function readableText(html: string): string {
  const body =
    /<b[^>]*>Results?:<\/b>([\s\S]*?)<\/table>/i.exec(html)?.[1] ?? html;
  return decodeHTML(
    body
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * What the character can do this round, read off the page.
 *
 * Saved combat macros share the skill dropdown and are not skills, so they are
 * excluded: only entries the game prices in MP or uses belong here.
 */
function parseActions(html: string): FightAction[] {
  const actions: FightAction[] = [
    { kind: "attack", label: "Attack with your weapon" },
  ];

  const skillSelect =
    /<select[^>]*name=["']?whichskill["']?[^>]*>([\s\S]*?)<\/select>/i.exec(
      html,
    );
  if (skillSelect) {
    for (const option of skillSelect[1].matchAll(
      /<option[^>]*value=["']?(\d+)["']?[^>]*>([^<]*)/gi,
    )) {
      const id = Number(option[1]);
      const label = decodeHTML(option[2]).trim();
      if (id === 0 || !label) continue;
      // Real combat skills are annotated with their cost or remaining uses.
      if (!/\(.*(Point|use|MP|Mojo|Soulsauce|Energy|Adventure)/i.test(label)) {
        continue;
      }
      actions.push({ kind: "skill", id, label });
    }
  }

  const itemSelect =
    /<select[^>]*name=["']?whichitem["']?[^>]*>([\s\S]*?)<\/select>/i.exec(
      html,
    );
  if (itemSelect) {
    for (const option of itemSelect[1].matchAll(
      /<option[^>]*value=["']?(\d+)["']?[^>]*>([^<]*)/gi,
    )) {
      const id = Number(option[1]);
      const label = decodeHTML(option[2]).trim();
      if (id === 0 || !label) continue;
      actions.push({ kind: "item", id, label });
    }
  }

  if (/<form name=runaway/i.test(html)) {
    actions.push({ kind: "runaway", label: "Run away from the fight" });
  }
  return actions;
}

export function parseFightState(html: string): FightState {
  if (!html) return { status: "ended", text: "" };

  const inFight =
    /<form name=attack|name=["']?whichskill|You're fighting/i.test(html);
  const text = readableText(html);

  if (!inFight) {
    if (LOST.test(html)) return { status: "lost", text };
    if (WON.test(html)) return { status: "won", text };
    // A fight that is over and did not go badly was won. Reporting these as
    // indeterminate made every zone show a 0% win rate despite no losses.
    return { status: "ended", text };
  }

  const monster =
    /<span id=["']?monname["']?>(.*?)<\/span>/i
      .exec(html)?.[1]
      ?.replace(/<[^>]+>/g, "")
      .trim() ?? "unknown monster";

  return { status: "ongoing", monster, text, actions: parseActions(html) };
}

export class Fight {
  #client: Client;

  constructor(client: Client) {
    this.#client = client;
  }

  /** The fight as it stands, without taking a round. */
  async getState(): Promise<FightState> {
    return parseFightState(
      await this.#client.fetchText("fight.php", { method: "GET" }),
    );
  }

  /** Whether a fight is open. A turn is not spent until it is resolved. */
  async inFight(): Promise<boolean> {
    return (await this.getState()).status === "ongoing";
  }

  /** Take one action, and report where the fight stands afterwards. */
  async act(action: FightAction): Promise<FightState> {
    return this.round(actionToMacro(action));
  }

  /** Submit a macro for this round. */
  async round(macroText: string): Promise<FightState> {
    return parseFightState(
      await this.#client.fetchText("fight.php", {
        form: { action: "macro", macrotext: macroText },
      }),
    );
  }
}
