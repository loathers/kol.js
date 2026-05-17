import styles from "./about.module.css";
import { registerCommand } from "./registry";

type AboutViewProps = { onClose(): void };

export function AboutView({ onClose: _ }: AboutViewProps) {
  return (
    <div className={styles.root}>
      <div className={styles.appTitle}>kolappse</div>
      <div className={styles.meta}>
        <div className={styles.line}>
          Version <span>{window.__KOLAPPSE_VERSION__ ?? "unknown"}</span>
        </div>
        <div className={styles.line}>
          Commit <span>{window.__KOLAPPSE_COMMIT__ ?? "unknown"}</span>
        </div>
      </div>
    </div>
  );
}

export function registerAboutCommand(): void {
  registerCommand({
    id: "about",
    label: "About kolappse",
    icon: "★",
    keywords: ["version", "info"],
    view: AboutView,
  });
}
