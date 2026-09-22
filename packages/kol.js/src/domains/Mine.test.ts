import { describe, expect, it, vi } from "vitest";

import { Client } from "../Client.js";
import {
  Mine,
  type MineSquare,
  accessibleSparkles,
  mineNumber,
  parseMine,
  whichOf,
} from "./Mine.js";

const KIND_NAMES = {
  open: "Open Cavern",
  sparkly: "Promising Chunk of Wall",
  rock: "Rocky Wall",
} as const;

/** The wall as the game draws it: one image per square, named in its alt text. */
function wall(squares: Array<[number, number, keyof typeof KIND_NAMES]>) {
  return squares
    .map(
      ([col, row, kind]) =>
        `<img src="mine.gif" alt="${KIND_NAMES[kind]} (${col},${row})">`,
    )
    .join("");
}

describe("parseMine", () => {
  it("reads each square's position and what it is", () => {
    expect(
      parseMine(
        wall([
          [1, 6, "sparkly"],
          [2, 6, "rock"],
          [3, 5, "open"],
        ]),
      ),
    ).toEqual([
      { col: 1, row: 6, kind: "sparkly" },
      { col: 2, row: 6, kind: "rock" },
      { col: 3, row: 5, kind: "open" },
    ]);
  });

  it("marks a square it does not recognise rather than dropping it", () => {
    expect(parseMine(`<img alt="Some New Thing (4,4)">`)).toEqual([
      { col: 4, row: 4, kind: "unknown" },
    ]);
  });

  it("yields nothing for a page that is not a mine", () => {
    expect(parseMine("<html>nothing here</html>")).toEqual([]);
  });
});

describe("whichOf", () => {
  it("encodes a square as the form field the page wants", () => {
    expect(whichOf({ col: 1, row: 6 })).toBe(49);
    expect(whichOf({ col: 6, row: 1 })).toBe(14);
  });
});

describe("accessibleSparkles", () => {
  it("treats the front row as always reachable", () => {
    const squares = parseMine(wall([[3, 6, "sparkly"]]));
    expect(accessibleSparkles(squares)).toHaveLength(1);
  });

  it("refuses a square further back with nothing dug next to it", () => {
    // Digging an unreachable square is refused, so this is legality rather
    // than a preference.
    const squares = parseMine(wall([[3, 3, "sparkly"]]));
    expect(accessibleSparkles(squares)).toEqual([]);
  });

  it.each<[string, [number, number]]>([
    ["left", [2, 3]],
    ["right", [4, 3]],
    ["behind", [3, 2]],
    ["in front", [3, 4]],
  ])("allows a square with an open cavern %s of it", (_side, [col, row]) => {
    const squares = parseMine(
      wall([
        [3, 3, "sparkly"],
        [col, row, "open"],
      ]),
    );
    expect(accessibleSparkles(squares)).toHaveLength(1);
  });

  it("ignores squares that are not sparkly", () => {
    const squares: MineSquare[] = parseMine(
      wall([
        [3, 6, "rock"],
        [4, 6, "open"],
      ]),
    );
    expect(accessibleSparkles(squares)).toEqual([]);
  });
});

describe("mineNumber", () => {
  it("recognises a mine url", () => {
    expect(mineNumber("mining=1")).toBe(1);
  });

  it.each(["adventure=30", "place=bathole", undefined])(
    "returns null for %s",
    (url) => {
      expect(mineNumber(url)).toBeNull();
    },
  );
});

describe("requests", () => {
  function setup(response = "") {
    const client = new Client("", "");
    const fetchText = vi.spyOn(client, "fetchText").mockResolvedValue(response);
    return { mine: new Mine(client), fetchText };
  }

  it("reads the grid without digging", async () => {
    const { mine, fetchText } = setup(wall([[1, 6, "sparkly"]]));
    await mine.getGrid(1);

    expect(fetchText).toHaveBeenCalledWith("mining.php", {
      method: "GET",
      query: { mine: "1" },
    });
  });

  it("digs a square by its encoded position", async () => {
    const { mine, fetchText } = setup("You acquire an item: <b>ore</b>");

    await expect(
      mine.dig(1, { col: 1, row: 6, kind: "sparkly" }),
    ).resolves.toMatchObject({ dug: true });
    expect(fetchText).toHaveBeenCalledWith("mining.php", {
      method: "GET",
      query: { mine: "1", which: "49" },
    });
  });

  it("reports a dig that achieved nothing", async () => {
    const { mine } = setup("<html>nothing happened</html>");
    await expect(mine.dig(1, 49)).resolves.toMatchObject({ dug: false });
  });
});
