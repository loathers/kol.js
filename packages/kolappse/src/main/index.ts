import { app } from "electron";
import { Client, ProxyServer, defineAction } from "kol.js";
import { join } from "node:path";

import { apiHandlers } from "./api.js";
import { decryptAccount, loadAccounts, saveAccount } from "./credentials.js";
import { decoratorInterceptors } from "./decorator.js";
import { initTray, setClient, setStatus } from "./tray.js";

declare const __COMMIT_HASH__: string;

const PORT = 8080;

function createClient(username = "", password = ""): Client {
  return new Client(username, password, { interceptors: appInterceptors });
}

async function login(username: string, password: string): Promise<Client> {
  const client = createClient(username, password);
  client.on("login", () => {
    proxy.setClient(client);
    setClient(client);
    setStatus("running", PORT);
  });
  client.on("logout", () => {
    proxy.setClient(createClient());
    setClient(null);
    setStatus("idle", PORT);
  });
  await client.login();
  return client;
}

async function switchAccount(username: string): Promise<void> {
  const account = loadAccounts().find((a) => a.username === username);
  const credentials = account ? decryptAccount(account) : null;
  if (!credentials) return;

  setStatus("starting", PORT);

  try {
    await login(credentials.username, credentials.password);
  } catch (err) {
    console.error("Failed to switch account:", err);
    setClient(null);
    setStatus("error", PORT);
  }
}

const detectLogin = defineAction({
  path: "login.php",
  parse({ req, body, success, failure }) {
    if (req.method !== "POST") return failure("Not a POST");
    const username = req.params.get("loginname");
    const password = req.params.get("password");
    if (!username || !password) return failure("Missing credentials");
    if (body.includes('name="loginname"')) return failure("Login page shown");
    return success({ username, password });
  },
  async onSuccess({ result }) {
    try {
      const client = await login(result.username, result.password);
      saveAccount(result.username, client.playerId, result.password);
    } catch (err) {
      console.error("Failed to switch to intercepted account:", err);
    }
  },
});

/**
 * The app's own handlers, which apply to whichever account is signed in. Given
 * to every client, since interception is per-client and a logout builds a fresh
 * one.
 */
const appInterceptors = [
  ...decoratorInterceptors(app.getVersion(), __COMMIT_HASH__),
  ...apiHandlers({ onLogin: switchAccount }),
  detectLogin,
];

// Serves the logged-out session until a login swaps in a real client.
const proxy = new ProxyServer(createClient());

app.dock?.hide();

app.on("ready", async () => {
  initTray(join(__dirname, "../../resources/icon.png"));
  await proxy.start(PORT);
  setStatus("idle", PORT);
});

app.on("before-quit", async () => {
  await proxy.stop();
});

app.on("window-all-closed", () => {
  // Keep running in tray even with no windows open
});
