import { describe, expect, test } from "vitest";

import {
  MoonSign,
  moonSignFromId,
  moonSignId,
  toMoonSign,
} from "./MoonSign.js";

describe("moonSignId", () => {
  test("matches the reincarnation form's option values", () => {
    expect(Object.values(MoonSign).map(moonSignId)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
  });

  test("round-trips through moonSignFromId", () => {
    for (const sign of Object.values(MoonSign)) {
      expect(moonSignFromId(moonSignId(sign))).toBe(sign);
    }
    expect(moonSignFromId(11)).toBeNull();
  });
});

describe("toMoonSign", () => {
  test("takes the name api.php uses", () => {
    expect(toMoonSign("Mongoose")).toBe(MoonSign.Mongoose);
    expect(toMoonSign("Bad Moon")).toBe(MoonSign.BadMoon);
  });

  test.each(["None", "(none)", "", null, undefined])(
    "reads %j as no sign",
    (input) => {
      expect(toMoonSign(input)).toBeNull();
    },
  );
});
