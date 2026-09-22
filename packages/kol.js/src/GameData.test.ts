import { describe, expect, it } from "vitest";

import { gameData } from "./GameData.js";

describe("findFolderByOffset", () => {
  it("walks the folders in order", async () => {
    for (let offset = 1; offset <= 28; offset += 1) {
      const folder = await gameData.findFolderByOffset(offset);
      expect(folder?.id).toBe(6617 + offset);
    }
  });

  it("resolves 01 to folder (red), not to item 1", async () => {
    // Item 1 is the seal-clubbing club, which is what an offset read as an
    // item id produces.
    const folder = await gameData.findFolderByOffset(1);
    expect(folder).toMatchObject({ id: 6618, name: "folder (red)" });
  });

  it("only ever resolves to a folder", async () => {
    for (const offset of [1, 12, 20, 22, 28]) {
      const folder = await gameData.findFolderByOffset(offset);
      expect(folder?.name).toMatch(/^folder \(/);
    }
  });

  it.each([0, -1, 999])("has no folder at %i", async (offset) => {
    await expect(gameData.findFolderByOffset(offset)).resolves.toBeNull();
  });
});
