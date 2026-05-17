import { Modal } from "../components/Modal";
import styles from "./about.module.css";
import { registerCommand } from "./registry";

type AboutDialogProps = { onClose(): void };

export function AboutDialog({ onClose }: AboutDialogProps) {
  return (
    <Modal title="About kolappse" onClose={onClose}>
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
    </Modal>
  );
}

export function registerAboutCommand(openDialog: (id: string) => void): void {
  registerCommand({
    id: "about",
    label: "About kolappse",
    keywords: ["version", "info"],
    action: () => openDialog("about"),
  });
}
