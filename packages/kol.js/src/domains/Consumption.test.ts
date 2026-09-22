import { describe, expect, it, vi } from "vitest";

import { Client } from "../Client.js";
import { Consumption } from "./Consumption.js";

function setup() {
  const client = new Client("", "");
  const fetchText = vi
    .spyOn(client, "fetchText")
    .mockResolvedValue("You acquire an item: <b>nothing</b>");
  return { consumption: new Consumption(client), fetchText };
}

describe("Consumption.use", () => {
  it("sends action=useitem when using several at once", async () => {
    const { consumption, fetchText } = setup();
    await consumption.use(1, 5);

    // Without action=useitem, multiuse.php answers with an ordinary page and
    // consumes nothing — the call looks like it worked and did not.
    expect(fetchText).toHaveBeenCalledWith("multiuse.php", {
      query: {
        which: 1,
        whichitem: 1,
        action: "useitem",
        quantity: 5,
        ajax: 1,
      },
    });
  });

  it("uses the single-item page for a quantity of one", async () => {
    const { consumption, fetchText } = setup();
    await consumption.use(1);

    expect(fetchText).toHaveBeenCalledWith("inv_use.php", {
      query: { which: 1, whichitem: 1, ajax: 1 },
    });
  });
});
