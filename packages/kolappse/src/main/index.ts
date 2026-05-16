import { join } from "node:path";
import { app } from "electron";
import { Client, ProxyServer, registerInterceptor } from "kol.js";
import { decryptAccount, loadAccounts, saveAccount } from "./credentials.js";
import { initTray, setActiveUsername, setStatus } from "./tray.js";

const PORT = 8080;

const proxy = new ProxyServer();

async function login(username: string, password: string): Promise<Client> {
  const client = new Client(username, password);
  await client.login();
  proxy.setClient(client);
  return client;
}

async function switchAccount(username: string): Promise<void> {
  const account = loadAccounts().find((a) => a.username === username);
  const credentials = account ? decryptAccount(account) : null;
  if (!credentials) return;

  setStatus("starting", PORT);

  try {
    await login(credentials.username, credentials.password);
    setActiveUsername(credentials.username);
    setStatus("running", PORT);
  } catch (err) {
    console.error("Failed to switch account:", err);
    setStatus("error", PORT);
  }
}

app.dock?.hide();

app.on("ready", async () => {
  initTray(join(__dirname, "../../resources/icon.png"), {
    onSwitchAccount: switchAccount,
  });
  await proxy.start(PORT);
  setStatus("idle", PORT);

  registerInterceptor({
    path: "login.php",
    onResponse: async (_client, req, res) => {
      if (req.method !== "POST") return;
      const interceptedUsername = req.params.get("loginname");
      const interceptedPassword = req.params.get("password");
      if (!interceptedUsername || !interceptedPassword) return;
      if (typeof res.body === "string" && res.body.includes('name="loginname"'))
        return;
      try {
        const client = await login(interceptedUsername, interceptedPassword);
        saveAccount(interceptedUsername, client.playerId, interceptedPassword);
        setActiveUsername(interceptedUsername);
        setStatus("running", PORT);
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
