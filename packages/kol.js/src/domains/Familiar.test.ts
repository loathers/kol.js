import { describe, expect, it, vi } from "vitest";

import { Client } from "../Client.js";
import { loadFixture } from "../testUtils.js";
import { Familiars } from "./Familiar.js";

const terrarium = () => loadFixture(__dirname, "familiar_terrarium.html");

describe("parse", () => {
  it("reads every familiar the page lists", async () => {
    const familiars = Familiars.parse(await terrarium());
    expect(familiars.length).toBeGreaterThan(300);
  });

  it("reads the weight and experience the old parser dropped", async () => {
    const familiars = Familiars.parse(await terrarium());
    const sombrero = familiars.find((f) => f.id === 18);

    expect(sombrero).toEqual({
      id: 18,
      race: "Hovering Sombrero",
      nickname: "Big Chungus",
      weight: 1,
      experience: 0,
      kills: 7076,
      available: true,
    });
  });

  it("gives every familiar a weight of at least one pound", async () => {
    const familiars = Familiars.parse(await terrarium());
    expect(familiars.every((f) => f.weight >= 1)).toBe(true);
  });

  it("does not confuse two familiars of the same species", async () => {
    const familiars = Familiars.parse(await terrarium());
    const ids = familiars.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("still lists a familiar the current path restricts", async () => {
    // A restricted familiar is owned and listed, but its row has no
    // take-with-you button, so the id has to come from the row's own image.
    const familiars = Familiars.parse(await terrarium());
    const riftlet = familiars.find((f) => f.id === 43);

    expect(riftlet).toMatchObject({
      race: "Temporal Riftlet",
      available: false,
    });
  });

  it("finds far more than only the takeable ones", async () => {
    const familiars = Familiars.parse(await terrarium());
    const available = familiars.filter((f) => f.available);

    expect(available.length).toBeGreaterThan(0);
    expect(familiars.length).toBeGreaterThan(available.length);
  });

  it("yields nothing for a page with no terrarium", () => {
    expect(Familiars.parse("<html>nothing here</html>")).toEqual([]);
  });
});

describe("take", () => {
  function setup(response: string) {
    const client = new Client("", "");
    const fetchText = vi.spyOn(client, "fetchText").mockResolvedValue(response);
    return { familiars: new Familiars(client), fetchText };
  }

  it("asks for the familiar by id", async () => {
    const { familiars, fetchText } = setup("var currentfam = 18;");
    await familiars.take(18);

    expect(fetchText).toHaveBeenCalledWith("familiar.php", {
      method: "GET",
      query: { action: "newfam", newfam: "18" },
    });
  });

  it("checks the page rather than assuming it worked", async () => {
    // Asking for a familiar the character does not have returns a perfectly
    // ordinary page and leaves whatever was out in place.
    const { familiars } = setup("<html>an ordinary terrarium page</html>");
    await expect(familiars.take(9)).resolves.toBe(false);
  });

  it("does not accept a different familiar coming out", async () => {
    const { familiars } = setup("var currentfam = 22;");
    await expect(familiars.take(9)).resolves.toBe(false);
  });
});
