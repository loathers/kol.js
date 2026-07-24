import { describe, expect, test } from "vitest";

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
});
