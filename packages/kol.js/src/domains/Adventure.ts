import { decodeHTML } from "entities";

import type { Client } from "../Client.js";
import { type ActionResult, defineAction } from "../interceptors/action.js";

/**
 * One button on a choice adventure, with the text written on it.
 *
 * The number alone means nothing — "1" does not say whether it leads to the
 * stream where the mosquito larva is or to the road that does not.
 */
export type ChoiceOption = {
  option: number;
  label: string;
  /**
   * Extra form fields this option needs beyond the option number.
   *
   * Some choices are a form rather than a row of buttons, carrying a radio
   * group; submitting the option alone is refused. Each combination is its own
   * thing to choose, so each is offered separately with the fields it needs.
   */
  extra?: Record<string, string>;
};

export type AdventureOutcome =
  | { type: "combat"; body: string }
  | {
      type: "choice";
      id: number;
      name: string;
      options: ChoiceOption[];
      body: string;
    }
  | { type: "noncombat"; name: string; body: string };

export type AdventureResult = ActionResult<AdventureOutcome>;

export type ParsedEncounter =
  | { kind: "none" }
  | { kind: "combat" }
  | { kind: "choice"; id: number; name: string }
  | { kind: "noncombat"; name: string };

export function extractEncounterName(body: string): string {
  return (
    body.match(/<center><b>([^<]+)<\/b>/)?.[1]?.trim() ??
    body.match(/<b>([^<]+)<\/b>\s*<p>/)?.[1]?.trim() ??
    // The blue page header, as used when place.php shows a pending choice
    body.match(/<b style="color: white">([^<]+)<\/b>/)?.[1]?.trim() ??
    ""
  );
}

/**
 * Pages whose query parameter is not named after the page.
 *
 * The rest follow the obvious rule — `<key>=<value>` becomes
 * `<key>.php?<key>=<value>` — so only the exceptions are written down.
 */
const SPECIAL_ZONE_PARAMS: Record<string, { param: string; value?: string }> = {
  place: { param: "whichplace" },
  crypt: { param: "action" },
  // The data records no value for this one; the throne room is the only part
  // of the Knob reachable this way.
  cobbsknob: { param: "action", value: "throneroom" },
};

/** The request a data-of-loathing location url describes. */
export function parseSpecialZone(url: string): {
  path: string;
  query: Record<string, string>;
} {
  const [key = "", value = ""] = url.split("=");
  const entry = SPECIAL_ZONE_PARAMS[key];
  // A value of "0" means the data records no value.
  const resolved = entry?.value ?? (value === "0" ? "" : value);
  const param = entry?.param ?? key;
  return {
    path: `${key}.php`,
    query: resolved ? { [param]: resolved } : {},
  };
}

/** Markup stripped and entities decoded, for text written on a button. */
function label(html: string): string {
  return decodeHTML(html.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The buttons a choice adventure is offering, with the text on each.
 *
 * Each button pairs a hidden option field with a submit input carrying the
 * text, so the two are matched up; a choice rendered as plain links instead
 * carries its label as the anchor text.
 */
export function extractChoiceOptions(body: string): ChoiceOption[] {
  const found = new Map<number, string>();

  const labelled =
    /<input[^>]*name=["']?option["']?\s+value=["']?(\d+)["']?[^>]*>[\s\S]{0,400}?<input[^>]*type=["']?submit["']?[^>]*value=["']([^"']*)["']/gi;
  for (const match of body.matchAll(labelled)) {
    found.set(Number(match[1]), label(match[2]));
  }

  // Links carry their label as the anchor text.
  for (const match of body.matchAll(
    /choice\.php[^"']*?option=(\d+)[^>]*>([^<]{1,120})</gi,
  )) {
    const option = Number(match[1]);
    if (!found.has(option)) found.set(option, label(match[2]));
  }

  // Anything still unlabelled is a real button we simply could not name.
  for (const match of body.matchAll(
    /name=["']?option["']?\s+value=["']?(\d+)/gi,
  )) {
    const option = Number(match[1]);
    if (!found.has(option)) found.set(option, "");
  }

  const options: ChoiceOption[] = [...found]
    .map(([option, text]) => ({ option, label: text }))
    .sort((a, b) => a.option - b.option);

  // A choice can be a form rather than a row of buttons. Where one carries a
  // radio group the option number alone is refused, so each radio is offered
  // as its own option with the field it needs.
  const expanded: ChoiceOption[] = [];
  for (const form of body.matchAll(/<form[^>]*>([\s\S]*?)<\/form>/gi)) {
    const inner = form[1];
    const option = Number(
      /name=["']?option["']?\s+value=["']?(\d+)/i.exec(inner)?.[1] ?? NaN,
    );
    if (!Number.isFinite(option)) continue;

    const radios = [
      ...inner.matchAll(/<input[^>]*type=["']?radio["']?[^>]*>/gi),
    ].map((m) => m[0]);
    if (radios.length === 0) continue;

    const submit =
      /type=["']?submit["']?[^>]*value=["']([^"']*)["']/i.exec(inner)?.[1] ??
      "";
    for (const radio of radios) {
      const name = /name=["']?([a-zA-Z0-9_]+)["']?/.exec(radio)?.[1];
      const value = /value=["']?([^"'\s>]+)/.exec(radio)?.[1];
      const described = /data-name=["']([^"']+)["']/.exec(radio)?.[1];
      if (!name || value === undefined) continue;
      expanded.push({
        option,
        label: `${label(submit)}: ${label(described ?? value)}`.trim(),
        extra: { [name]: value },
      });
    }
  }

  if (expanded.length === 0) return options;
  // Keep the plain options that had no radios of their own.
  const withRadios = new Set(expanded.map((entry) => entry.option));
  return [
    ...expanded,
    ...options.filter((entry) => !withRadios.has(entry.option)),
  ].sort((a, b) => a.option - b.option);
}

export function parseAdventureBody(body: string): ParsedEncounter {
  if (
    body.includes("You don't have enough Adventures") ||
    body.includes("You're out of adventures")
  ) {
    return { kind: "none" };
  }

  const choiceId =
    // KoL emits unquoted attributes: <input type=hidden name=whichchoice value=211>
    body.match(/name=["']?whichchoice["']?\s+value=["']?(\d+)/i)?.[1] ??
    body.match(/whichchoice=(\d+)/)?.[1];
  if (choiceId) {
    return {
      kind: "choice",
      id: Number(choiceId),
      name: extractEncounterName(body),
    };
  }

  if (
    body.includes("fightform") ||
    body.includes("id='monpic'") ||
    body.includes("combat.gif")
  ) {
    return { kind: "combat" };
  }

  return { kind: "noncombat", name: extractEncounterName(body) };
}

function toOutcome(
  parsed: Exclude<ParsedEncounter, { kind: "none" }>,
  body: string,
): AdventureOutcome {
  if (parsed.kind === "combat") return { type: "combat", body };
  if (parsed.kind === "choice")
    return {
      type: "choice",
      id: parsed.id,
      name: parsed.name,
      options: extractChoiceOptions(body),
      body,
    };
  return { type: "noncombat", name: parsed.name, body };
}

function toActionResult(
  body: string,
  success: (data: AdventureOutcome) => ActionResult<AdventureOutcome>,
  failure: (reason: string) => ActionResult<AdventureOutcome>,
): ActionResult<AdventureOutcome> {
  const parsed = parseAdventureBody(body);
  if (parsed.kind === "none") return failure("Out of adventures");
  return success(toOutcome(parsed, body));
}

const adventureAction = defineAction<AdventureOutcome>({
  path: "adventure.php",
  parse({ body, success, failure }) {
    return toActionResult(body, success, failure);
  },
});

const choiceAction = defineAction<AdventureOutcome>({
  path: "choice.php",
  parse({ body, success, failure }) {
    return toActionResult(body, success, failure);
  },
});

export class Adventure {
  #client: Client;

  constructor(client: Client) {
    this.#client = client;
    client.interceptors.add(adventureAction, choiceAction);
  }

  async adventure(snarfblat: number): Promise<AdventureResult> {
    return adventureAction.perform(this.#client, {
      query: { snarfblat },
    });
  }

  /**
   * Answer a choice adventure.
   *
   * `extra` carries the fields a form-shaped choice needs alongside the option
   * number; take them from the `ChoiceOption` being answered. Such a choice is
   * refused outright when sent the option number on its own, so these go as a
   * POST rather than in the query.
   */
  async choice(
    whichchoice: number,
    option: number,
    extra?: Record<string, string>,
  ): Promise<AdventureResult> {
    if (extra && Object.keys(extra).length > 0) {
      return choiceAction.perform(this.#client, {
        method: "POST",
        form: { whichchoice, option, ...extra },
      });
    }
    return choiceAction.perform(this.#client, {
      query: { whichchoice, option },
    });
  }

  /**
   * Enter a location that is not adventure.php.
   *
   * data-of-loathing records these as `<key>=<value>`, where the key names the
   * page but NOT the query parameter: place.php wants `whichplace`, crypt.php
   * wants `action`. Sending the key as the parameter fetches a valid page that
   * is simply the wrong one, which costs no turn and raises no error, so a
   * caller sits on the step forever.
   */
  async adventureAt(url: string): Promise<string> {
    const { path, query } = parseSpecialZone(url);
    return this.#client.fetchText(path, { method: "GET", query });
  }

  async place(whichplace: string, action?: string): Promise<string> {
    return this.#client.fetchText("place.php", {
      query: { whichplace, ...(action && { action }) },
    });
  }

  /**
   * Non-turn-consuming probe of the current forced encounter, if any. The
   * server shows the pending choice or fight regardless of the page fetched,
   * so a bare place.php reveals whether the character is stuck in one.
   */
  async currentEncounter(): Promise<AdventureOutcome | null> {
    const body = await this.#client.fetchText("place.php");
    const parsed = parseAdventureBody(body);
    if (parsed.kind === "choice" || parsed.kind === "combat") {
      return toOutcome(parsed, body);
    }
    // An idle place.php page is not a noncombat encounter
    return null;
  }

  /** Whether the character is currently stuck in a choice adventure. */
  async inChoice(): Promise<boolean> {
    return (await this.currentEncounter())?.type === "choice";
  }
}
