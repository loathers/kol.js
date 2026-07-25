import { describe, expect, test } from "vitest";

import { loadFixture } from "../testUtils.js";
import { Account } from "./Account.js";

describe("parseAutoattackMacros", () => {
  test("no macros", () => {
    const html = `<select name=whichattack><option value="0">disabled</option><option value="1">Some Skill</option></select>`;

    expect(Account.parseAutoattackMacros(html)).toEqual({
      options: [],
      selected: null,
    });
  });

  test("macros with a selection", () => {
    const html = [
      `<select name=whichattack>`,
      `<option value="0">disabled</option>`,
      `<option value="99000001">OTHER (Combat Macro)</option>`,
      `<option selected="selected" value="99000002">CAGEBOT (Combat Macro)</option>`,
      `</select>`,
    ].join("");

    expect(Account.parseAutoattackMacros(html)).toEqual({
      options: [
        { id: 99000001, name: "OTHER" },
        { id: 99000002, name: "CAGEBOT" },
      ],
      selected: { id: 99000002, name: "CAGEBOT" },
    });
  });

  test("real combat tab with a macro selected", async () => {
    const html = await loadFixture(
      __dirname,
      "account_combat_tab_selected.html",
    );
    const { options, selected } = Account.parseAutoattackMacros(html);

    expect(options).toHaveLength(23);
    expect(selected).toEqual({ id: 99124763, name: "justattack" });
    expect(options).toContainEqual({ id: 99128184, name: "30rounds" });
    // A macro with an empty name still parses
    expect(options).toContainEqual({ id: 99211333, name: "" });
  });

  test("real combat tab with autoattack disabled", async () => {
    const html = await loadFixture(
      __dirname,
      "account_combat_tab_unselected.html",
    );
    const { options, selected } = Account.parseAutoattackMacros(html);

    expect(options).toHaveLength(23);
    expect(selected).toBeNull();
  });
});
