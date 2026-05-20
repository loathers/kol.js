import { app } from "electron";
import { Client, ProxyServer, defineAction } from "kol.js";
import { join } from "node:path";

import { registerApiHandlers } from "./api.js";
import { decryptAccount, loadAccounts, saveAccount } from "./credentials.js";
import { registerDecorator } from "./decorator.js";
import { initTray, setClient, setStatus } from "./tray.js";

declare const __COMMIT_HASH__: string;

const PORT = 8080;

const proxy = new ProxyServer();

async function login(username: string, password: string): Promise<Client> {
  const client = new Client(username, password);
  client.on("login", () => {
    proxy.setClient(client);
    setClient(client);
    setStatus("running", PORT);
  });
  client.on("logout", () => {
    proxy.setClient(new Client());
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

app.dock?.hide();

app.on("ready", async () => {
  registerDecorator(app.getVersion(), __COMMIT_HASH__);
  registerApiHandlers({ onLogin: (username) => switchAccount(username) });

  initTray(join(__dirname, "../../resources/icon.png"));
  await proxy.start(PORT);
  setStatus("idle", PORT);

  defineAction({
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
});

app.on("before-quit", async () => {
  await proxy.stop();
});

app.on("window-all-closed", () => {
  // Keep running in tray even with no windows open
});
