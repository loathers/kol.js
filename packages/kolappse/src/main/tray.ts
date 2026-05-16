import { app, Menu, nativeImage, shell, Tray } from "electron";
import { loadAccounts } from "./credentials.js";

export type ProxyStatus = "idle" | "starting" | "running" | "error";

let tray: Tray | null = null;
let activeUsername: string | null = null;

let onSwitchAccount: (username: string) => void = () => {};

export function initTray(
  iconPath: string,
  handlers: { onSwitchAccount: (username: string) => void },
): void {
  const icon = nativeImage.createFromPath(iconPath);
  icon.setTemplateImage(true);
  tray = new Tray(icon);
  tray.setToolTip("Kolappse");
  onSwitchAccount = handlers.onSwitchAccount;
}

export function setActiveUsername(username: string): void {
  activeUsername = username;
}

export function setStatus(status: ProxyStatus, port: number): void {
  tray?.setContextMenu(buildMenu(status, port));
}

function statusLabel(status: ProxyStatus): string {
  if (status === "running") return "Open in Browser";
  if (status === "starting") return "Starting…";
  if (status === "error") return "Proxy Error";
  return "Unauthenticated";
}

function buildMenu(status: ProxyStatus, port: number): Menu {
  const accounts = loadAccounts();

  const accountItems =
    accounts.length > 0
      ? [
          ...accounts.map((a) => ({
            label: `${a.username} (#${a.playerId})`,
            type: "radio" as const,
            checked: a.username === activeUsername,
            enabled: a.username !== activeUsername,
            click: () => onSwitchAccount(a.username),
          })),
          { type: "separator" as const },
        ]
      : [];

  return Menu.buildFromTemplate([
    { label: `KoLappse v${app.getVersion()}`, enabled: false },
    { type: "separator" },
    {
      label: statusLabel(status),
      enabled: status === "running" || status === "idle",
      click: () =>
        shell.openExternal(
          status === "idle"
            ? `http://localhost:${port}/login.php`
            : `http://localhost:${port}`,
        ),
    },
    { type: "separator" },
    {
      label: "Accounts",
      submenu: [
        ...accountItems,
        {
          label: "Add Account…",
          enabled: status === "running",
          click: () =>
            shell.openExternal(`http://localhost:${port}/login.php`),
        },
      ],
    },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() },
  ]);
}
