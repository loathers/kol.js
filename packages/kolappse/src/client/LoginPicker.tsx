import { useEffect, useState } from "react";
import styles from "./LoginPicker.module.css";

type Account = { username: string; playerId: string };

export function LoginPicker() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [loggingIn, setLoggingIn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/_kolappse/api/accounts")
      .then((r) => r.json())
      .then((data: Account[]) => {
        setAccounts(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  async function handleLogin(username: string) {
    setLoggingIn(username);
    setError(null);
    try {
      const body = new URLSearchParams({ username });
      const res = await fetch("/_kolappse/api/login", {
        method: "POST",
        body,
      });
      if (res.ok) {
        window.location.href = "/";
      } else {
        const data = await res.json();
        setError(data.error ?? "Login failed");
        setLoggingIn(null);
      }
    } catch {
      setError("Login failed");
      setLoggingIn(null);
    }
  }

  if (loading || accounts.length === 0) return null;

  return (
    <div className={styles.root}>
      <div className={styles.header}><span className={styles.headerLabel}>Saved Accounts</span></div>
      <div className={styles.list}>
        {accounts.map((a) => (
          <button
            key={a.username}
            className={styles.account}
            disabled={loggingIn !== null}
            onClick={() => handleLogin(a.username)}
          >
            <span className={styles.username}>
              {loggingIn === a.username ? "Logging in…" : a.username}
            </span>
            <span className={styles.playerId}>#{a.playerId}</span>
          </button>
        ))}
        {error && <div className={`${styles.status} ${styles.error}`}>{error}</div>}
      </div>
    </div>
  );
}
