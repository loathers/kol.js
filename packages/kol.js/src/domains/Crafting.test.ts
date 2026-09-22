import { describe, expect, it, vi } from "vitest";

import { Client } from "../Client.js";
import { Crafting } from "./Crafting.js";

function setup(response = "") {
  const client = new Client("", "");
  const fetchText = vi.spyOn(client, "fetchText").mockResolvedValue(response);
  return { crafting: new Crafting(client), fetchText };
}

describe("combine", () => {
  it("posts the two items and the quantity", async () => {
    const { crafting, fetchText } = setup("You acquire an item: <b>x</b>");

    await expect(crafting.combine(1, 2, 3)).resolves.toBe(true);
    expect(fetchText).toHaveBeenCalledWith("craft.php", {
      form: { mode: "combine", action: "craft", a: 1, b: 2, qty: 3 },
    });
  });

  it("reports failure when nothing was acquired", async () => {
    const { crafting } = setup("You don't have the ingredients");
    await expect(crafting.combine(1, 2)).resolves.toBe(false);
  });
});

describe("makeMeatStuff", () => {
  it("uses its own form rather than an ordinary combine", async () => {
    const { crafting, fetchText } = setup("You acquire 10 meat pastes");

    await expect(crafting.makeMeatStuff(25, 10)).resolves.toBe(true);
    expect(fetchText).toHaveBeenCalledWith("craft.php", {
      form: { action: "makepaste", whichitem: 25, qty: 10 },
    });
  });
});
