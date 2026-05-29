import type { Client } from "../Client.js";
import {
  type ActionResult,
  defineAction,
} from "../interceptors/action.js";

export type AdventureOutcome =
  | { type: "combat" }
  | { type: "choice"; id: number; name: string }
  | { type: "noncombat"; name: string };

export type AdventureResult = ActionResult<AdventureOutcome>;

type ParsedBody =
  | { kind: "none" }
  | { kind: "combat" }
  | { kind: "choice"; id: number; name: string }
  | { kind: "noncombat"; name: string };

function extractName(body: string): string {
  return (
    body.match(/<center><b>([^<]+)<\/b>/)?.[1]?.trim() ??
    body.match(/<b>([^<]+)<\/b>\s*<p>/)?.[1]?.trim() ??
    ""
  );
}

function parseBody(body: string): ParsedBody {
  if (
    body.includes("You don't have enough Adventures") ||
    body.includes("You're out of adventures")
  ) {
    return { kind: "none" };
  }

  const choiceId =
    body.match(/name="whichchoice" value="(\d+)"/)?.[1] ??
    body.match(/whichchoice[=\s"']+(\d+)/)?.[1];
  if (choiceId) {
    return { kind: "choice", id: Number(choiceId), name: extractName(body) };
  }

  if (
    body.includes("fightform") ||
    body.includes("id='monpic'") ||
    body.includes("combat.gif")
  ) {
    return { kind: "combat" };
  }

  return { kind: "noncombat", name: extractName(body) };
}

function toActionResult(
  parsed: ParsedBody,
  success: (data: AdventureOutcome) => ActionResult<AdventureOutcome>,
  failure: (reason: string) => ActionResult<AdventureOutcome>,
): ActionResult<AdventureOutcome> {
  if (parsed.kind === "none") return failure("Out of adventures");
  if (parsed.kind === "combat") return success({ type: "combat" });
  if (parsed.kind === "choice")
    return success({ type: "choice", id: parsed.id, name: parsed.name });
  return success({ type: "noncombat", name: parsed.name });
}

const adventureAction = defineAction<AdventureOutcome>({
  path: "adventure.php",
  parse({ body, success, failure }) {
    return toActionResult(parseBody(body), success, failure);
  },
});

const choiceAction = defineAction<AdventureOutcome>({
  path: "choice.php",
  parse({ body, success, failure }) {
    return toActionResult(parseBody(body), success, failure);
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
}
