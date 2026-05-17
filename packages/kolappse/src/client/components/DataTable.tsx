import styles from "./DataTable.module.css";
import shared from "../shared.module.css";

type Row = { key: string; value: unknown };
type Group = { label: string; rows: Row[] };

function formatValue(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function DataTable({ groups }: { groups: Group[] }) {
  return (
    <div className={styles.table}>
      {groups.map((g) => (
        <div key={g.label}>
          <div className={styles.groupLabel}>{g.label}</div>
          {g.rows.length === 0 ? (
            <div className={shared.status}>No entries</div>
          ) : (
            g.rows.map((r) => (
              <div className={styles.row} key={r.key}>
                <span className={styles.key}>{r.key}</span>
                <span className={styles.value}>{formatValue(r.value)}</span>
              </div>
            ))
          )}
        </div>
      ))}
    </div>
  );
}
