import type { Client } from "../Client.js";
import { type ActionResult, defineAction } from "../interceptors/action.js";

export type AdventureOutcome =
  | { type: "combat"; body: string }
  | { type: "choice"; id: number; name: string; body: string }
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
    return { type: "choice", id: parsed.id, name: parsed.name, body };
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
  }

  async adventure(snarfblat: number): Promise<AdventureResult> {
    return adventureAction(this.#client, {
      query: { snarfblat },
    });
  }

  async choice(whichchoice: number, option: number): Promise<AdventureResult> {
    return choiceAction(this.#client, {
      query: { whichchoice, option },
    });
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
