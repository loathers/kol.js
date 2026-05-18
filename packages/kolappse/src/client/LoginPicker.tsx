import { useEffect, useState } from "react";

import styles from "./LoginPicker.module.css";
import { formatLastLogin } from "./utils/formatLastLogin";

type Account = { username: string; playerId: string; lastLoginAt?: string };

export function LoginPicker() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string>("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/_kolappse/api/accounts")
      .then((r) => r.json())
      .then((data: Account[]) => {
        setAccounts(data);
        if (data.length > 0) setSelected(data[0].username);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  async function handleLogin() {
    if (!selected) return;
    setLoggingIn(true);
    setError(null);
    try {
      const body = new URLSearchParams({ username: selected });
      const res = await fetch("/_kolappse/api/login", { method: "POST", body });
      if (res.ok) {
        window.location.href = "/";
      } else {
        const data = await res.json();
        setError(data.error ?? "Login failed");
        setLoggingIn(false);
      }
    } catch {
      setError("Login failed");
      setLoggingIn(false);
    }
  }

  if (loading || accounts.length === 0) return null;

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <span className={styles.headerLabel}>Saved Accounts</span>
      </div>
      <div className={styles.body}>
        <select
          className={styles.select}
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          disabled={loggingIn}
        >
          {accounts.map((a) => {
            const lastLogin = formatLastLogin(a.lastLoginAt);
            return (
              <option key={a.username} value={a.username}>
                {a.username} (#{a.playerId}){lastLogin ? ` · ${lastLogin}` : ""}
              </option>
            );
          })}
        </select>
        <button
          className={styles.loginButton}
          disabled={loggingIn}
          onClick={handleLogin}
        >
          {loggingIn ? "Logging in…" : "Log In"}
        </button>
        {error && (
          <div className={`${styles.status} ${styles.error}`}>{error}</div>
        )}
      </div>
    </div>
  );
}
