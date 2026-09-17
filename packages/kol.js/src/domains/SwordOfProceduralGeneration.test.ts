import { describe, expect, it } from "vitest";

import { SwordOfProceduralGeneration } from "./SwordOfProceduralGeneration.js";

// Every case below is a real sword, scraped from desc_item.php in November 2026.
describe("SwordOfProceduralGeneration", () => {
  it.each([
    [
      1197090,
      [
        { name: "Spell Damage Percent", value: "+100" },
        { name: "Cold Damage", value: "+40" },
        { name: "Sleaze Resistance", value: "+3" },
        { name: "Damage vs. Zombies", value: "+80" },
        { name: "Item Drop", value: "+10" },
      ],
    ],
    // Lowest resistance, and a monster type that takes flat damage.
    [
      18991,
      [
        { name: "Muscle Percent", value: "+90" },
        { name: "Stench Damage", value: "+25" },
        { name: "Sleaze Resistance", value: "+1" },
        { name: "Damage vs. Orcs", value: "+140" },
        { name: "Initiative", value: "+15" },
      ],
    ],
    // Resistance at its cap, which narrows the pool for the remaining points.
    [
      21,
      [
        { name: "Weapon Damage Percent", value: "+130" },
        { name: "Sleaze Damage", value: "+30" },
        { name: "Cold Resistance", value: "+5" },
        { name: "Damage vs. Vampires", value: "+50" },
        { name: "Item Drop", value: "+10" },
      ],
    ],
    // Extremes of each value, which the 29 point budget makes mutually exclusive.
    [
      1069035,
      [
        { name: "Weapon Damage Percent", value: "+150" },
        { name: "Cold Damage", value: "+30" },
        { name: "Hot Resistance", value: "+2" },
        { name: "Damage vs. Skeletons", value: "+60" },
        { name: "Familiar Weight", value: "+5" },
      ],
    ],
    [
      130427,
      [
        { name: "Mysticality Percent", value: "+60" },
        { name: "Hot Damage", value: "+80" },
        { name: "Spooky Resistance", value: "+1" },
        { name: "Damage vs. Bugbears", value: "+60" },
        { name: "Meat Drop", value: "+20" },
      ],
    ],
    [
      836140,
      [
        { name: "Muscle Percent", value: "+40" },
        { name: "Hot Damage", value: "+25" },
        { name: "Cold Resistance", value: "+4" },
        { name: "Damage vs. Ghosts", value: "+160" },
        { name: "Critical Hit Percent", value: "+20" },
      ],
    ],
    [
      126855,
      [
        { name: "Mysticality Percent", value: "+20" },
        { name: "Cold Damage", value: "+50" },
        { name: "Stench Resistance", value: "+4" },
        { name: "Damage vs. Bugbears", value: "+130" },
        { name: "Initiative", value: "+15" },
      ],
    ],
    [
      1569204,
      [
        { name: "Moxie Percent", value: "+140" },
        { name: "Stench Damage", value: "+10" },
        { name: "Sleaze Resistance", value: "+4" },
        { name: "Damage vs. Vampires", value: "+90" },
        { name: "Critical Hit Percent", value: "+20" },
      ],
    ],
  ])("derives the sword for player %i", (playerId, modifiers) => {
    expect(SwordOfProceduralGeneration.getModifiers(playerId)).toEqual(
      modifiers,
    );
  });

  it("always spends exactly 29 points", () => {
    // The four budgeted modifiers come first, in a fixed order, at these scales.
    const SCALES = [10, 5, 1, 10];

    for (let playerId = 1; playerId < 500; playerId++) {
      const modifiers = SwordOfProceduralGeneration.getModifiers(playerId);
      const total = SCALES.reduce(
        (sum, scale, i) => sum + Number(modifiers[i].value) / scale,
        0,
      );
      expect(total).toBe(29);
    }
  });
});
