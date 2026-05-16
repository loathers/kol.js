import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { app, safeStorage } from "electron";

export interface StoredAccount {
  username: string;
  playerId: string;
  encryptedPassword: string;
}

function accountsPath() {
  return join(app.getPath("userData"), "accounts.json");
}

export function loadAccounts(): StoredAccount[] {
  if (!safeStorage.isEncryptionAvailable()) return [];
  try {
    return JSON.parse(readFileSync(accountsPath(), "utf8")) as StoredAccount[];
  } catch {
    return [];
  }
}

export function saveAccount(
  username: string,
  playerId: string,
  password: string,
): void {
  if (!safeStorage.isEncryptionAvailable()) return;
  const encryptedPassword = safeStorage
    .encryptString(password)
    .toString("base64");
  const accounts = loadAccounts().filter((a) => a.username !== username);
  accounts.unshift({ username, playerId, encryptedPassword });
  writeFileSync(accountsPath(), JSON.stringify(accounts));
}

export function decryptAccount(
  account: StoredAccount,
): { username: string; playerId: string; password: string } | null {
  try {
    const password = safeStorage.decryptString(
      Buffer.from(account.encryptedPassword, "base64"),
    );
    return { username: account.username, playerId: account.playerId, password };
  } catch {
    return null;
  }
}
