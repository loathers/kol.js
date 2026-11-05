import { describe, expect, it, vi } from "vitest";

import { Client } from "../Client.js";
import { AuthError } from "../errors.js";
import type { Interceptor, KolRequest, KolResponse } from "./types.js";

const request = (path: string): KolRequest => ({
  path,
  method: "GET",
  params: new URLSearchParams(),
});

const html = (body: string): KolResponse => ({
  status: 200,
  contentType: "text/html",
  body,
});

describe("scoping", () => {
  it("does not leak one client's interceptor to another", () => {
    const a = new Client("a", "");
    const b = new Client("b", "");
    const only: Interceptor = { path: "main.php", onRequest: vi.fn() };

    a.interceptors.add(only);

    expect(a.interceptors.matching(request("main.php"))).toContain(only);
    expect(b.interceptors.matching(request("main.php"))).not.toContain(only);
  });

  it("takes an app-wide set at construction", () => {
    const shared: Interceptor = { path: "main.php", onRequest: vi.fn() };
    const a = new Client("a", "", { interceptors: [shared] });
    const b = new Client("b", "", { interceptors: [shared] });

    expect(a.interceptors.matching(request("main.php"))).toContain(shared);
    expect(b.interceptors.matching(request("main.php"))).toContain(shared);
  });

  it("removes without disturbing the rest of the list", () => {
    const client = new Client("a", "");
    const kept: Interceptor = { path: "main.php", onRequest: vi.fn() };
    const dropped: Interceptor = { path: "main.php", onRequest: vi.fn() };
    client.interceptors.add(kept, dropped);

    expect(client.interceptors.remove(dropped)).toBe(true);
    expect(client.interceptors.remove(dropped)).toBe(false);

    const matching = client.interceptors.matching(request("main.php"));
    expect(matching).toContain(kept);
    expect(matching).not.toContain(dropped);
  });
});

describe("matching", () => {
  it("honours path, regex and matches filters", () => {
    const client = new Client("a", "");
    const byPath: Interceptor = { path: "fight.php", onRequest: vi.fn() };
    const byRegex: Interceptor = { path: /^choice/, onRequest: vi.fn() };
    const byMatcher: Interceptor = {
      matches: (req) => req.params.get("action") === "equip",
      onRequest: vi.fn(),
    };
    const everything: Interceptor = { onRequest: vi.fn() };
    client.interceptors.add(byPath, byRegex, byMatcher, everything);

    expect(client.interceptors.matching(request("fight.php"))).toContain(
      byPath,
    );
    expect(client.interceptors.matching(request("main.php"))).not.toContain(
      byPath,
    );
    expect(client.interceptors.matching(request("choice.php"))).toContain(
      byRegex,
    );
    expect(client.interceptors.matching(request("main.php"))).toContain(
      everything,
    );

    const equip: KolRequest = {
      path: "inv_equip.php",
      method: "GET",
      params: new URLSearchParams({ action: "equip" }),
    };
    expect(client.interceptors.matching(equip)).toContain(byMatcher);
  });
});

describe("ordering", () => {
  it("runs interceptors in registration order", async () => {
    const client = new Client("a", "");
    const order: string[] = [];
    client.interceptors.add(
      { path: "main.php", onRequest: () => void order.push("first") },
      { path: "main.php", onRequest: () => void order.push("second") },
    );

    await client.interceptors.request(request("main.php"));

    expect(order).toEqual(["first", "second"]);
  });

  it("lets addFirst pre-empt a handler registered earlier", async () => {
    const client = new Client("a", "");
    client.interceptors.add({ path: "main.php", handle: () => html("late") });
    client.interceptors.addFirst({
      path: "main.php",
      handle: () => html("early"),
    });

    const handled = await client.interceptors.handle(request("main.php"));

    expect(handled?.body).toBe("early");
  });

  it("falls through a handler that declines", async () => {
    const client = new Client("a", "");
    client.interceptors.add(
      { path: "main.php", handle: () => null },
      { path: "main.php", handle: () => html("mine") },
    );

    const handled = await client.interceptors.handle(request("main.php"));

    expect(handled?.body).toBe("mine");
  });

  it("folds decorators over each other's output", async () => {
    const client = new Client("a", "");
    client.interceptors.add(
      { path: "main.php", decorate: (_c, _r, res) => `${String(res.body)}+a` },
      { path: "main.php", decorate: (_c, _r, res) => `${String(res.body)}+b` },
    );

    const out = await client.interceptors.decorate(
      request("main.php"),
      html("body"),
    );

    expect(out).toBe("body+a+b");
  });
});

describe("domain wiring", () => {
  it("gives every client the library's own actions", () => {
    const client = new Client("a", "");

    // inv_equip.php?action=equip is Equipment's action, registered by the
    // domain the Client constructs — proof the wiring survives construction
    // rather than depending on a process-wide list.
    const equip: KolRequest = {
      path: "inv_equip.php",
      method: "POST",
      params: new URLSearchParams({ action: "equip" }),
    };
    expect(client.interceptors.matching(equip).length).toBeGreaterThan(0);
  });
});

describe("vetoing a request", () => {
  it("stops the request before any I/O when onRequest throws", async () => {
    const client = new Client("a", "");
    const fetchSpy = vi.spyOn(
      client as unknown as { session: (...args: unknown[]) => unknown },
      "session",
    );

    client.interceptors.add({
      path: "devchat.php",
      onRequest() {
        throw new Error("forbidden page");
      },
    });

    await expect(client.fetchText("devchat.php")).rejects.toThrow(
      "forbidden page",
    );
    expect(fetchSpy).not.toHaveBeenCalled();

    // Positive control: a path the interceptor does not name gets past
    // interception and fails later, in the request machinery. Without this the
    // assertion above would also pass if nothing ran at all.
    await expect(client.fetchText("main.php")).rejects.toThrow(AuthError);
  });
});
