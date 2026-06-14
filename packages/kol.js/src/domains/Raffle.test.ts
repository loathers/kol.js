import { describe, expect, it, vi } from "vitest";

import { Client } from "../Client.js";
import { loadFixture } from "../testUtils.js";
import { Raffle } from "./Raffle.js";

const { json, text } = vi.hoisted(() => ({ json: vi.fn(), text: vi.fn() }));

vi.mock("../Client.js", async (importOriginal) => {
  const client = await importOriginal<typeof import("../Client.js")>();
  client.Client.prototype.login = () => Promise.resolve(true);
  client.Client.prototype.checkLoggedIn = () => Promise.resolve(true);
  client.Client.prototype.fetchText = text;
  client.Client.prototype.fetchJson = json;
  return client;
});

const client = new Client("", "");

describe("Raffle", () => {
  it("can fetch the current raffle", async () => {
    text.mockResolvedValueOnce(
      await loadFixture(import.meta.dirname, "raffle.html"),
    );
    text.mockResolvedValueOnce("<!-- itemid: 1 -->");
    text.mockResolvedValueOnce("<!-- itemid: 2 -->");
    text.mockResolvedValueOnce("<!-- itemid: 3 -->");
    text.mockResolvedValueOnce("<!-- itemid: 4 -->");
    text.mockResolvedValueOnce("<!-- itemid: 4 -->");
    text.mockResolvedValueOnce("<!-- itemid: 4 -->");
    json.mockResolvedValueOnce({
      pwd: "abc123",
      playerid: "1",
      daynumber: "100",
      ascensions: "0",
      turnsplayed: "0",
      level: "1",
      hardcore: "0",
      roninleft: "0",
      path: "0",
      sign: "None",
      adventures: "40",
      class: "0",
      hp: "10",
      maxhp: 10,
      mp: "10",
      maxmp: 10,
      spleen: "10",
      full: "10",
      drunk: "10",
    });

    const raffle = new Raffle(client);
    const result = await raffle.getRaffle();

    expect(result).toMatchObject({
      today: {
        first: 1,
        second: 2,
      },
      yesterday: [
        {
          player: { id: 809337, name: "Collective Consciousness" },
          item: 3,
          tickets: 3333,
        },
        {
          player: { id: 852958, name: "Ryo_Sangnoir" },
          item: 4,
          tickets: 1011,
        },
        {
          player: { id: 1765063, name: "SSpectre_Karasu" },
          item: 4,
          tickets: 1000,
        },
        {
          player: { id: 1652370, name: "yueli7" },
          item: 4,
          tickets: 2040,
        },
      ],
    });
  });
});
