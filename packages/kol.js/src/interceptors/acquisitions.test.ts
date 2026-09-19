import { describe, expect, test, vi } from "vitest";

import { Client } from "../Client.js";

const seen = (client: Client) => ({
  inventory: vi.spyOn(client.inventory.get, "invalidate"),
  effects: vi.spyOn(client.effects.get, "invalidate"),
  equipment: vi.spyOn(client.equipment.get, "invalidate"),
});

/** Drive a response through the pipeline the way fetchText does. */
const respond = async (path: string, body: string) => {
  const client = new Client("", "");
  const spies = seen(client);
  vi.spyOn(
    client as unknown as { session: () => Promise<string> },
    "session",
  ).mockResolvedValue(body);
  Object.defineProperty(client, "loggedIn", { value: true });
  vi.spyOn(client, "login").mockResolvedValue(true);
  vi.spyOn(client, "checkLoggedIn").mockResolvedValue(true);

  await client.fetchText(path);
  return spies;
};

describe("acquisition interceptor", () => {
  test("a single item invalidates the inventory", async () => {
    const spies = await respond(
      "choice.php",
      "You acquire an item: <b>letter from King Ralph XI</b>",
    );

    expect(spies.inventory).toHaveBeenCalled();
    expect(spies.effects).not.toHaveBeenCalled();
  });

  test("a stack of items invalidates the inventory", async () => {
    const spies = await respond(
      "adventure.php",
      "You acquire <b>3 sugar sheets</b>",
    );

    expect(spies.inventory).toHaveBeenCalled();
  });

  test.each(["effect", "intrinsic"])("an %s invalidates effects", async (k) => {
    const spies = await respond(
      "adventure.php",
      `You acquire an ${k}: <b>x</b>`,
    );

    expect(spies.effects).toHaveBeenCalled();
    expect(spies.inventory).not.toHaveBeenCalled();
  });

  test("prose about acquiring does not invalidate anything", async () => {
    // The reincarnation form says "items you acquired in your last life".
    const spies = await respond(
      "afterlife.php",
      "no restrictions on the items you acquire on the run",
    );

    expect(spies.inventory).not.toHaveBeenCalled();
    expect(spies.effects).not.toHaveBeenCalled();
  });

  test("any inv_equip response invalidates equipment", async () => {
    const spies = await respond(
      "inv_equip.php",
      "<html>Outfit equipped.</html>",
    );

    expect(spies.equipment).toHaveBeenCalled();
  });

  test("an ordinary page leaves every cache alone", async () => {
    const spies = await respond("main.php", "<html>nothing happened</html>");

    expect(spies.inventory).not.toHaveBeenCalled();
    expect(spies.effects).not.toHaveBeenCalled();
    expect(spies.equipment).not.toHaveBeenCalled();
  });
});
