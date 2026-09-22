import { describe, expect, it, vi } from "vitest";

import { Client } from "../Client.js";
import {
  Fight,
  type FightState,
  actionToMacro,
  parseFightState,
} from "./Fight.js";

/** Narrow to an open fight, so its actions can be asserted on. */
function ongoing(state: FightState) {
  if (state.status !== "ongoing") {
    throw new Error(`expected an open fight, got ${state.status}`);
  }
  return state;
}

/** A fight page shaped like the game's, with the given dropdown contents. */
function fightPage({
  monster = "spooky vampire",
  skills = "",
  items = "",
  runaway = false,
  results = "You hit it for 5 damage.",
} = {}) {
  return (
    `<html><body><span id='monname'>${monster}</span>` +
    `<b>Results:</b>${results}</table>` +
    `<form name=attack></form>` +
    (skills
      ? `<select name=whichskill><option value=0>(select a skill)</option>${skills}</select>`
      : "") +
    (items ? `<select name=whichitem>${items}</select>` : "") +
    (runaway ? `<form name=runaway></form>` : "") +
    `</body></html>`
  );
}

describe("parseFightState", () => {
  it("reports an open fight and the monster in it", () => {
    const state = parseFightState(fightPage());
    expect(state).toMatchObject({
      status: "ongoing",
      monster: "spooky vampire",
    });
  });

  it("always offers a plain attack", () => {
    const state = parseFightState(fightPage());
    expect(state).toMatchObject({
      actions: [{ kind: "attack", label: "Attack with your weapon" }],
    });
  });

  it("offers the skills the page prices", () => {
    const state = ongoing(
      parseFightState(
        fightPage({
          skills: `<option value=7001>Saucegeyser (24 MP)</option>`,
        }),
      ),
    );
    expect(state.actions).toContainEqual({
      kind: "skill",
      id: 7001,
      label: "Saucegeyser (24 MP)",
    });
  });

  it("leaves out saved combat macros, which share the skill dropdown", () => {
    // They are not skills, and submitting one as a skill does nothing.
    const state = ongoing(
      parseFightState(
        fightPage({
          skills:
            `<option value=7001>Saucegeyser (24 MP)</option>` +
            `<option value=99999>my saved macro</option>`,
        }),
      ),
    );
    expect(state.actions.map((a) => a.label)).not.toContain("my saved macro");
  });

  it("offers combat items and the chance to run", () => {
    const state = ongoing(
      parseFightState(
        fightPage({
          items: `<option value=518>dictionary</option>`,
          runaway: true,
        }),
      ),
    );
    expect(state.actions).toContainEqual({
      kind: "item",
      id: 518,
      label: "dictionary",
    });
    expect(state.actions).toContainEqual({
      kind: "runaway",
      label: "Run away from the fight",
    });
  });

  it("keeps the whole of the game's account of the round", () => {
    // The decision-relevant sentence is often the last one — whether the blow
    // landed, whether it bounced off, what dropped.
    const state = parseFightState(
      fightPage({
        results: "You hit it. <b>Your attack bounces off harmlessly.</b>",
      }),
    );
    expect(state.text).toBe("You hit it. Your attack bounces off harmlessly.");
  });

  it.each([
    "You win the fight!",
    "Victory!",
    "You acquire an item: <b>a thing</b>",
    "You gain 12 Meat",
  ])("reports %j as a win", (body) => {
    expect(parseFightState(`<html>${body}</html>`).status).toBe("won");
  });

  it.each(["You lose.", "you are beaten up", "That's a shame"])(
    "reports %j as a loss",
    (body) => {
      expect(parseFightState(`<html>${body}</html>`).status).toBe("lost");
    },
  );

  it("reports an empty body as ended", () => {
    expect(parseFightState("")).toEqual({ status: "ended", text: "" });
  });
});

describe("actionToMacro", () => {
  it.each([
    [{ kind: "attack" as const, label: "" }, "attack;"],
    [{ kind: "skill" as const, id: 7001, label: "" }, "skill 7001;"],
    [{ kind: "item" as const, id: 518, label: "" }, "use 518;"],
    [{ kind: "runaway" as const, label: "" }, "runaway;"],
  ])("renders %o", (action, expected) => {
    expect(actionToMacro(action)).toBe(expected);
  });
});

describe("requests", () => {
  function setup(response = "") {
    const client = new Client("", "");
    const fetchText = vi.spyOn(client, "fetchText").mockResolvedValue(response);
    return { fight: new Fight(client), fetchText };
  }

  it("reads the fight without taking a round", async () => {
    const { fight, fetchText } = setup(fightPage());
    await fight.getState();

    expect(fetchText).toHaveBeenCalledWith("fight.php", { method: "GET" });
  });

  it("submits one action as a one-round macro", async () => {
    // A macro is the form KoL accepts uniformly for attacking, casting and
    // using items.
    const { fight, fetchText } = setup(fightPage());
    await fight.act({ kind: "skill", id: 7001, label: "Saucegeyser" });

    expect(fetchText).toHaveBeenCalledWith("fight.php", {
      form: { action: "macro", macrotext: "skill 7001;" },
    });
  });

  it("says whether a fight is open", async () => {
    const { fight } = setup(fightPage());
    await expect(fight.inFight()).resolves.toBe(true);
  });

  it("says a finished fight is not open", async () => {
    const { fight } = setup("<html>You win the fight!</html>");
    await expect(fight.inFight()).resolves.toBe(false);
  });
});
