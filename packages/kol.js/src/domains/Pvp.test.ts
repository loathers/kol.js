import { describe, expect, it, vi } from "vitest";

import { Client } from "../Client.js";
import { loadFixture } from "../testUtils.js";
import { Pvp } from "./Pvp.js";

const { text } = vi.hoisted(() => ({ text: vi.fn() }));

vi.mock("../Client.js", async (importOriginal) => {
  const client = await importOriginal<typeof import("../Client.js")>();
  client.Client.prototype.login = () => Promise.resolve(true);
  client.Client.prototype.checkLoggedIn = () => Promise.resolve(true);
  client.Client.prototype.fetchText = text;
  return client;
});

const client = new Client("", "");

describe("Pvp", () => {
  it("can parse the current season", async () => {
    const rulesHtml = await loadFixture(import.meta.dirname, "pvp-rules.html");
    const shopHtml = await loadFixture(import.meta.dirname, "pvp-shop.html");

    const result = Pvp.parseSeason(rulesHtml, shopHtml);

    expect(result).toMatchObject({
      seasonNumber: 86,
      seasonName: "Optimal Season",
    });
    expect(result.endsAt).toEqual(new Date("2026-09-01"));
  });

  it("can fetch the current season", async () => {
    text
      .mockResolvedValueOnce(
        await loadFixture(import.meta.dirname, "pvp-rules.html"),
      )
      .mockResolvedValueOnce(
        await loadFixture(import.meta.dirname, "pvp-shop.html"),
      );

    const pvp = new Pvp(client);
    const result = await pvp.getCurrentSeason();

    expect(result).toMatchObject({
      seasonNumber: 86,
      seasonName: "Optimal Season",
    });
  });
});
