import { describe, expect, test, vi } from "vitest";

import { Client } from "../Client.js";
import { loadFixture } from "../testUtils.js";
import { CombatMacros, findMacroId } from "./CombatMacros.js";

describe("findMacroId", () => {
  test("finds a saved macro by name in the macro list page", async () => {
    const html = await loadFixture(__dirname, "combatmacros_save.html");
    expect(findMacroId(html, "KOLJS-TEST")).toBe(211333);
    expect(findMacroId(html, "justattack")).toBe(124763);
  });

  test("returns null for an unknown macro", async () => {
    const html = await loadFixture(__dirname, "combatmacros_save.html");
    expect(findMacroId(html, "NO-SUCH-MACRO")).toBeNull();
  });
});

describe("list", () => {
  test("parses a real macro list page", async () => {
    const client = new Client("", "");
    const macros = new CombatMacros(client);
    vi.spyOn(client, "fetchText").mockResolvedValueOnce(
      await loadFixture(__dirname, "combatmacros_save.html"),
    );

    const list = await macros.list();
    expect(list).toContainEqual({ id: 211333, name: "KOLJS-TEST" });
    expect(list).toContainEqual({ id: 124763, name: "justattack" });
  });
});

describe("getText", () => {
  test("reads the macro text from the edit form", async () => {
    const client = new Client("", "");
    const macros = new CombatMacros(client);
    const spy = vi
      .spyOn(client, "fetchText")
      .mockResolvedValueOnce(
        await loadFixture(__dirname, "combatmacros_edit.html"),
      );

    expect(await macros.getText(211333)).toBe("attack with weapon\nrepeat");
    // The editor only opens via the edit form POST
    expect(spy).toHaveBeenCalledWith("account_combatmacros.php", {
      method: "POST",
      form: { action: "edit", macroid: 211333, what: "Edit" },
    });
  });
});
