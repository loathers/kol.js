import { useEffect, useState } from "react";

import shared from "../shared.module.css";
import { formatLastLogin } from "../utils/formatLastLogin";
import { registerCommand } from "./registry";
import styles from "./switchAccount.module.css";

type Account = { username: string; playerId: string; lastLoginAt?: string };

type SwitchAccountViewProps = { onClose(): void };

function SwitchAccountView({ onClose: _ }: SwitchAccountViewProps) {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/_kolappse/api/accounts").then(
        (r) => r.json() as Promise<Account[]>,
      ),
      fetch("/_kolappse/api/me").then(
        (r) => r.json() as Promise<{ username: string }>,
      ),
    ])
      .then(([all, me]) => {
        const others = all
          .filter((a) => a.username !== me.username)
          .sort((a, b) => {
            if (!a.lastLoginAt && !b.lastLoginAt) return 0;
            if (!a.lastLoginAt) return 1;
            if (!b.lastLoginAt) return -1;
            return b.lastLoginAt.localeCompare(a.lastLoginAt);
          });
        setAccounts(others);
      })
      .catch(() => setError("Failed to load accounts"));
  }, []);

  async function handleSwitch(username: string) {
    setSwitchingTo(username);
    try {
      const body = new URLSearchParams({ username });
      const res = await fetch("/_kolappse/api/login", { method: "POST", body });
      if (res.ok) {
        window.location.reload();
      } else {
        const data = await res.json();
        setError(data.error ?? "Login failed");
        setSwitchingTo(null);
      }
    } catch {
      setError("Login failed");
      setSwitchingTo(null);
    }
  }

  if (error)
    return <div className={`${shared.status} ${shared.error}`}>{error}</div>;
  if (!accounts) return <div className={shared.status}>Loading…</div>;
  if (accounts.length === 0)
    return <div className={shared.status}>No other saved accounts.</div>;

  return (
    <div className={styles.panel}>
      {accounts.map((a) => {
        const lastLogin = formatLastLogin(a.lastLoginAt);
        return (
          <button
            key={a.username}
            className={styles.account}
            disabled={switchingTo !== null}
            onClick={() => handleSwitch(a.username)}
          >
            <span className={styles.name}>
              {switchingTo === a.username ? "Switching…" : a.username}
              <span className={styles.playerId}>#{a.playerId}</span>
            </span>
            {lastLogin && <span className={styles.lastLogin}>{lastLogin}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function registerSwitchAccountCommand(): void {
  registerCommand({
    id: "switch-account",
    label: "Switch Account",
    icon: "⇄",
    keywords: ["login", "account", "switch", "user"],
    view: SwitchAccountView,
  });
}
