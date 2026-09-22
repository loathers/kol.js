import { describe, expect, it, vi } from "vitest";

import { Client } from "../Client.js";
import {
  COLUMNS,
  ROWS,
  Tiles,
  isTilePuzzle,
  letterFor,
  nextTile,
  parseTiles,
  wasCrushed,
} from "./Tiles.js";

/**
 * A grid shaped like the game's: 7 rows of 9, every row greyed except the one
 * still to be climbed, and the answer letter planted at a known column.
 */
function page(
  currentRow: number,
  answerColumn: number,
  answer = letterFor(currentRow),
): string {
  const rows: string[] = [];
  for (let row = 0; row < ROWS; row += 1) {
    const cells: string[] = [];
    for (let column = 0; column < COLUMNS; column += 1) {
      const open = row === currentRow;
      // BANS are the letters the solution uses, so filler comes from outside
      // them except where the answer is deliberately planted.
      const letter =
        open && column === answerColumn ? (answer ?? "Z") : "QWXYZKPHT"[column];
      const img = `<img src="tile.gif" alt='Tile labeled "${letter}"'>`;
      cells.push(
        open
          ? `<td class='cell'><a class=nounder href='tiles.php?action=jump&whichtile=${column}'>${img}</a></td>`
          : `<td class='cell greyed'>${img}</td>`,
      );
    }
    rows.push(`<tr>${cells.join("")}</tr>`);
  }
  return `<html><body><table>${rows.join("")}</table></body></html>`;
}

describe("parseTiles", () => {
  it("finds the grid and the row still open", () => {
    const grid = parseTiles(page(6, 3));
    expect(grid).not.toBeNull();
    expect(grid!.currentRow).toBe(6);
    expect(grid!.letters).toHaveLength(ROWS);
    expect(grid!.letters[0]).toHaveLength(COLUMNS);
  });

  it("returns null for a page that is not the puzzle", () => {
    expect(parseTiles("<html>ordinary page</html>")).toBeNull();
  });
});

describe("letterFor", () => {
  it("spells BANANAS from the bottom row upwards", () => {
    // Row 6 is the bottom, and it wants the first letter.
    expect([6, 5, 4, 3, 2, 1, 0].map((row) => letterFor(row)).join("")).toBe(
      "BANANAS",
    );
  });

  it("has nothing left to ask for past the top", () => {
    expect(letterFor(-1)).toBeNull();
  });
});

describe("nextTile", () => {
  it("finds the column carrying the letter the solution needs", () => {
    const grid = parseTiles(page(6, 4))!;
    expect(nextTile(grid)).toBe(4);
  });

  it("refuses rather than guessing when the letter is absent", () => {
    // Stepping on the wrong tile costs all of your HP, so there is no sensible
    // fallback here.
    const grid = parseTiles(page(6, 4, "Q"))!;
    expect(nextTile(grid)).toBeNull();
  });
});

describe("isTilePuzzle / wasCrushed", () => {
  it("recognises the puzzle from a response body", () => {
    expect(isTilePuzzle(page(6, 1))).toBe(true);
    expect(isTilePuzzle("<html>tiles.php but no grid</html>")).toBe(false);
    expect(isTilePuzzle("<html>nothing</html>")).toBe(false);
  });

  it("recognises the pillar", () => {
    expect(wasCrushed("<b>Squish!</b> you are flat")).toBe(true);
    expect(wasCrushed(page(6, 1))).toBe(false);
  });
});

describe("solve", () => {
  function setup(pages: string[]) {
    const client = new Client("", "");
    let call = 0;
    const fetchText = vi
      .spyOn(client, "fetchText")
      .mockImplementation(() => Promise.resolve(pages[call++] ?? "done"));
    return { tiles: new Tiles(client), fetchText };
  }

  it("climbs the grid a row at a time and returns what is left behind", async () => {
    // Six jumps take rows 6..1; the seventh page is what the game leaves.
    const pages = [5, 4, 3, 2, 1, 0].map((row) => page(row, 2));
    const { tiles, fetchText } = setup([...pages, "<html>choice 125</html>"]);

    const result = await tiles.solve(page(6, 2));

    expect(result).toBe("<html>choice 125</html>");
    expect(fetchText).toHaveBeenCalledWith("tiles.php", {
      method: "GET",
      query: { action: "jump", whichtile: "2" },
    });
  });

  it("returns null when there is no puzzle open", async () => {
    const { tiles } = setup(["<html>ordinary page</html>"]);
    await expect(tiles.solve()).resolves.toBeNull();
  });

  it("looks the puzzle up when given no body", async () => {
    const { tiles, fetchText } = setup([page(6, 2), "<html>done</html>"]);
    await tiles.solve();
    expect(fetchText).toHaveBeenCalledWith("tiles.php", { method: "GET" });
  });

  it("stops rather than guessing when the row offers no answer", async () => {
    const { tiles } = setup([]);
    await expect(tiles.solve(page(6, 2, "Q"))).rejects.toThrow(
      /offers no tile/,
    );
  });

  it("reports being crushed instead of carrying on", async () => {
    const { tiles } = setup([]);
    await expect(tiles.solve("tiles.php Tile labeled Squish!")).rejects.toThrow(
      /crushed/,
    );
  });
});
