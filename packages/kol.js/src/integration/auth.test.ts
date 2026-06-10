import { describe, it } from "vitest";

import { createTestClient } from "./TestClient.js";

describe.concurrent("auth integration", () => {
  it("login succeeds with correct credentials", async (ctx) => {
    const client = await createTestClient(ctx);

    ctx.expect(await client.login()).toBe(true);
  });

  it("login fails with wrong password", async (ctx) => {
    const client = await createTestClient(ctx, "testuser", "wrongpass");

    ctx.expect(await client.login()).toBe(false);
  });

  it("login fails with unknown user", async (ctx) => {
    const client = await createTestClient(ctx, "nobody", "nopass");

    ctx.expect(await client.login()).toBe(false);
  });

  it("checkLoggedIn returns false before login", async (ctx) => {
    const client = await createTestClient(ctx);

    ctx.expect(await client.checkLoggedIn()).toBe(false);
  });

  it("checkLoggedIn returns true after login", async (ctx) => {
    const client = await createTestClient(ctx);
    await client.login();

    ctx.expect(await client.checkLoggedIn()).toBe(true);
  });

  it("login succeeds when status has empty-array effects and intrinsics", async (ctx) => {
    // KoL serialises empty associative arrays as `[]`; the status schema must
    // accept that without reporting a valid login as failed (AuthError).
    const client = await createTestClient(ctx);

    ctx.expect(await client.login()).toBe(true);
    ctx.expect(await client.checkLoggedIn()).toBe(true);
  });

  it("session persists across multiple requests without re-login", async (ctx) => {
    const client = await createTestClient(ctx);
    await client.login();

    const status1 = await client.fetchStatus();
    const kmails = await client.kmail.fetch();
    const messages = await client.chat.fetch();
    const status2 = await client.fetchStatus();

    // Same pwd means the same session — no re-login happened
    ctx.expect(status1.pwd).toBeTruthy();
    ctx.expect(status2.pwd).toBe(status1.pwd);
    ctx.expect(kmails).toEqual([]);
    ctx.expect(messages).toEqual([]);
  });

  it("logout clears session", async (ctx) => {
    const client = await createTestClient(ctx);
    await client.login();
    ctx.expect(await client.checkLoggedIn()).toBe(true);

    await client.logout();
    ctx.expect(await client.checkLoggedIn()).toBe(false);
  });

  it("login emits login event with player info", async (ctx) => {
    const client = await createTestClient(ctx);

    let payload: { playerName: string; playerId: string } | null = null;
    client.on("login", (p) => {
      payload = p;
    });

    await client.login();

    ctx.expect(payload).toEqual({ playerName: "testuser", playerId: "1" });
  });

  it("login event not re-emitted when already logged in", async (ctx) => {
    const client = await createTestClient(ctx);
    await client.login();

    let count = 0;
    client.on("login", () => {
      count++;
    });
    await client.checkLoggedIn();

    ctx.expect(count).toBe(0);
  });

  it("logout emits logout event with player info", async (ctx) => {
    const client = await createTestClient(ctx);
    await client.login();

    let payload: { playerName: string; playerId: string } | null = null;
    client.on("logout", (p) => {
      payload = p;
    });

    await client.logout();

    ctx.expect(payload).toEqual({ playerName: "testuser", playerId: "1" });
  });

  it("login deduplicates concurrent calls", async (ctx) => {
    const client = await createTestClient(ctx);

    const results = await Promise.all([
      client.login(),
      client.login(),
      client.login(),
    ]);

    ctx.expect(results).toEqual([true, true, true]);
  });
});
