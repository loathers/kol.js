import { app, Menu, nativeImage, shell, Tray } from "electron";
import type { Client } from "kol.js";

export type ProxyStatus = "idle" | "starting" | "running" | "error";

let tray: Tray | null = null;
let activeClient: Client | null = null;

export function initTray(iconPath: string): void {
  const icon = nativeImage.createFromPath(iconPath);
  icon.setTemplateImage(true);
  tray = new Tray(icon);
  tray.setToolTip("Kolappse");
}

export function setClient(client: Client | null): void {
  activeClient = client;
}

export function setStatus(status: ProxyStatus, port: number): void {
  tray?.setContextMenu(buildMenu(status, port));
}

function buildMenu(status: ProxyStatus, port: number): Menu {
  const playerItems =
    activeClient !== null
      ? [
          {
            label: `${activeClient.username} (#${activeClient.playerId})`,
            enabled: false,
          },
          {
            label: `Level ${activeClient.level} ${activeClient.class?.name ?? ""}`,
            enabled: false,
          },
          {
            label: activeClient.path?.name ?? "No Path",
            enabled: false,
          },
          {
            label: `${activeClient.adventures} adventures remaining`,
            enabled: false,
          },
          {
            label: `HP: ${activeClient.hp}/${activeClient.maxHp}`,
            enabled: false,
          },
          {
            label: `MP: ${activeClient.mp}/${activeClient.maxMp}`,
            enabled: false,
          },
          { type: "separator" as const },
        ]
      : [];

  return Menu.buildFromTemplate([
    { label: `KoLappse v${app.getVersion()}`, enabled: false },
    { type: "separator" },
    ...playerItems,
    {
      label: "Open in Browser",
      enabled: status === "running" || status === "idle",
      click: () =>
        shell.openExternal(
          status === "idle"
            ? `http://localhost:${port}/login.php`
            : `http://localhost:${port}`,
        ),
    },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() },
  ]);
}
