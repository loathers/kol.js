import { describe, expect, it, vi } from "vitest";

import { Client } from "../Client.js";
import { Crypt, parseCrypt } from "./Crypt.js";

/** The map as the game draws it, with an image per corner still defiled. */
const map = (defiled: string[], heart = false) =>
  `<html><body><img src="otherimages/cyrpt/cyrptmap.gif">` +
  defiled.map((c) => `<img src="otherimages/cyrpt/${c}.gif">`).join("") +
  (heart ? `<img src="otherimages/cyrpt/thecrypt_heart.gif">` : "") +
  `</body></html>`;

describe("parseCrypt", () => {
  it("reports every corner still defiled", () => {
    expect(parseCrypt(map(["ul", "ur", "ll", "lr"]))).toEqual({
      nook: false,
      niche: false,
      cranny: false,
      alcove: false,
      haertOpen: false,
    });
  });

  it("reports a corner as clear once its image is gone", () => {
    // The log gives one Evilometer total for all four, so this is the only
    // thing that says which are done.
    expect(parseCrypt(map(["ur", "ll", "lr"]))).toMatchObject({
      nook: true,
      niche: false,
      cranny: false,
      alcove: false,
    });
  });

  it("maps each corner to its own quadrant", () => {
    expect(parseCrypt(map(["ul"]))).toMatchObject({
      nook: false,
      niche: true,
      cranny: true,
      alcove: true,
    });
  });

  it("reports the Haert as open once all four are clear", () => {
    expect(parseCrypt(map([], true))).toEqual({
      nook: true,
      niche: true,
      cranny: true,
      alcove: true,
      haertOpen: true,
    });
  });

  it("returns null for a page that is not the Cyrpt", () => {
    // Saying "all clear" because no corner image was found would open the
    // Haert by accident.
    expect(parseCrypt("<html>an ordinary page</html>")).toBeNull();
  });
});

describe("getState", () => {
  it("reads crypt.php", async () => {
    const client = new Client("", "");
    const fetchText = vi
      .spyOn(client, "fetchText")
      .mockResolvedValue(map(["ul"]));

    await expect(new Crypt(client).getState()).resolves.toMatchObject({
      nook: false,
    });
    expect(fetchText).toHaveBeenCalledWith("crypt.php", { method: "GET" });
  });
});
