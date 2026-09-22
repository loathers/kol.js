import type { Client } from "../Client.js";

/**
 * tiles.php — the Hidden Temple's tile puzzle.
 *
 * Choice 123 option 2 drops the character into a 7x9 grid of lettered tiles
 * that is not a choice adventure at all. It is its own page, and while it is
 * open the game bounces every other request back to it, so a client that does
 * not know about it wedges permanently. Nothing in the quest log mentions it.
 *
 * There is exactly one right answer, known in advance and the same every time:
 * climb from the bottom row to the top spelling BANANAS. Any other tile drops a
 * stone pillar on you for all of your HP.
 */

/** Rows are climbed bottom-to-top, so the bottom row wants the first letter. */
const SOLUTION = "BANANAS";
export const ROWS = 7;
export const COLUMNS = 9;

/**
 * Every cell in document order, with the row that is still open.
 *
 * Rows already climbed are greyed and their tiles are no longer links; the one
 * live row is the one to jump from. Reading the class is how the page says
 * where you are — there is no counter to consult.
 */
export type TileGrid = { letters: string[][]; currentRow: number };

const CELL =
  /<td class='(cell|cell greyed)'[^>]*>.*?'Tile labeled "(.)"'>(?:<\/a>)?<\/td>/gis;

export function parseTiles(html: string): TileGrid | null {
  const letters: string[][] = [];
  let currentRow = -1;
  let count = 0;

  for (const match of html.matchAll(CELL)) {
    const row = Math.floor(count / COLUMNS);
    if (row >= ROWS) return null;
    if (match[1] === "cell") currentRow = row;
    (letters[row] ??= [])[count % COLUMNS] = match[2].toUpperCase();
    count += 1;
  }

  if (count !== ROWS * COLUMNS || currentRow < 0) return null;
  return { letters, currentRow };
}

/** The letter the open row has to match, or null once the climb is finished. */
export function letterFor(currentRow: number): string | null {
  const index = ROWS - 1 - currentRow;
  return index >= 0 && index < SOLUTION.length ? SOLUTION[index] : null;
}

/**
 * Which tile to jump to next, as the column index tiles.php wants.
 *
 * Null means the grid does not offer the letter the solution needs, which
 * should not happen — jumping anyway is what costs all the HP, so the caller
 * stops instead of guessing.
 */
export function nextTile(grid: TileGrid): number | null {
  const wanted = letterFor(grid.currentRow);
  if (wanted === null) return null;
  const index = (grid.letters[grid.currentRow] ?? []).indexOf(wanted);
  return index < 0 ? null : index;
}

/** The puzzle, recognised from any response body. */
export function isTilePuzzle(html: string): boolean {
  return /tiles\.php/i.test(html) && /Tile labeled/i.test(html);
}

/** The pillar. */
export function wasCrushed(html: string): boolean {
  return /Squish!/i.test(html);
}

export class Tiles {
  #client: Client;

  constructor(client: Client) {
    this.#client = client;
  }

  /**
   * Climb the puzzle, if that is where the character is.
   *
   * Returns the page left behind once the grid is gone — the game hands over
   * choice 125 at the top — or null if there was no puzzle to climb. Every jump
   * is a page load and none of them costs an adventure.
   */
  async solve(body?: string): Promise<string | null> {
    let html = body ?? "";
    if (!isTilePuzzle(html)) {
      html = await this.#client.fetchText("tiles.php", { method: "GET" });
      if (!isTilePuzzle(html)) return null;
    }

    // Bounded by the grid: seven rows, so seven jumps at the very most. A page
    // that stops advancing would otherwise loop here forever.
    for (let jump = 0; jump < ROWS; jump += 1) {
      if (wasCrushed(html)) {
        throw new Error("Tile puzzle: stepped wrong and was crushed");
      }
      const grid = parseTiles(html);
      if (!grid) return html;
      const column = nextTile(grid);
      if (column === null) {
        throw new Error(
          `Tile puzzle: row ${grid.currentRow} offers no tile for the solution ` +
            `(${grid.letters[grid.currentRow]?.join("") ?? "?"})`,
        );
      }
      html = await this.#client.fetchText("tiles.php", {
        method: "GET",
        query: { action: "jump", whichtile: String(column) },
      });
    }
    return html;
  }
}
