import type { Client } from "../Client.js";

/**
 * mining.php — the cavern wall.
 *
 * A mine is not a zone. "Itznotyerzitz Mine (in Disguise)", where the Trapper's
 * ore is, is recorded by the game's own data as `mining=1` rather than
 * `adventure=N`, and adventure.php has nothing to send there: mining is a
 * square clicked on mining.php, one per adventure.
 *
 * Squares are named and positioned by the alt text the page puts on each
 * image, which is the only handle the markup offers.
 */

/** One square of the cavern wall. */
export type MineSquare = {
  /** 1-6, left to right. */
  col: number;
  /** 1-6, back to front. */
  row: number;
  kind: "open" | "sparkly" | "rock" | "unknown";
};

const KINDS: Record<string, MineSquare["kind"]> = {
  "Open Cavern": "open",
  "Promising Chunk of Wall": "sparkly",
  "Rocky Wall": "rock",
};

/** Every square the page shows, from the alt text on each cell's image. */
export function parseMine(html: string): MineSquare[] {
  const squares: MineSquare[] = [];
  for (const match of html.matchAll(
    /alt=['"]([^'"(]*?) \(([1-6]),([1-6])\)['"]/g,
  )) {
    squares.push({
      col: Number(match[2]),
      row: Number(match[3]),
      kind: KINDS[match[1].trim()] ?? "unknown",
    });
  }
  return squares;
}

/** A square's form field: mining.php?mine=N&which=<this>. */
export function whichOf(square: { col: number; row: number }): number {
  return square.col + 8 * square.row;
}

/**
 * The sparkly squares that can actually be dug.
 *
 * The front row is always reachable; anything further back has to be
 * cardinally adjacent to a square already dug out. Digging an unreachable one
 * is refused, so this is legality rather than a choice of where to dig — every
 * sparkly square pays the same.
 */
export function accessibleSparkles(squares: MineSquare[]): MineSquare[] {
  const at = new Map(
    squares.map((square) => [`${square.col},${square.row}`, square]),
  );
  const open = (col: number, row: number) =>
    at.get(`${col},${row}`)?.kind === "open";
  return squares.filter(
    (square) =>
      square.kind === "sparkly" &&
      (square.row === 6 ||
        open(square.col - 1, square.row) ||
        open(square.col + 1, square.row) ||
        open(square.col, square.row - 1) ||
        open(square.col, square.row + 1)),
  );
}

/** Which mine a location url names, or null where it is an ordinary zone. */
export function mineNumber(url: string | undefined): number | null {
  const match = /^mining=(\d+)$/.exec(url ?? "");
  return match ? Number(match[1]) : null;
}

export class Mine {
  #client: Client;

  constructor(client: Client) {
    this.#client = client;
  }

  /** The cavern wall as it stands. Costs no adventure. */
  async getGrid(mine: number): Promise<MineSquare[]> {
    return parseMine(
      await this.#client.fetchText("mining.php", {
        method: "GET",
        query: { mine: String(mine) },
      }),
    );
  }

  /** Dig one square. Costs an adventure. */
  async dig(
    mine: number,
    square: MineSquare | number,
  ): Promise<{ dug: boolean; body: string }> {
    const which = typeof square === "number" ? square : whichOf(square);
    const body = await this.#client.fetchText("mining.php", {
      method: "GET",
      query: { mine: String(mine), which: String(which) },
    });
    return { dug: /You acquire|You dig|smash|rubble/i.test(body), body };
  }
}
