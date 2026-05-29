import type { ComponentType } from "react";

import styles from "./Dock.module.css";

type DockItem = {
  id: string;
  title: string;
  icon?: string;
  View: ComponentType<{ onClose(): void }>;
};

type DockProps = {
  items: DockItem[];
  onRestore(id: string): void;
  onClose(id: string): void;
};

export function Dock({ items, onRestore, onClose }: DockProps) {
  if (items.length === 0) return null;

  return (
    <div className={styles.dock}>
      {items.map((item) => (
        <div
          key={item.id}
          className={styles.chip}
          onClick={() => onRestore(item.id)}
        >
          {item.icon && <span className={styles.icon}>{item.icon}</span>}
          <span className={styles.label}>{item.title}</span>
          <button
            className={styles.close}
            title="Close"
            onClick={(e) => {
              e.stopPropagation();
              onClose(item.id);
            }}
          >
            x
          </button>
        </div>
      ))}
    </div>
  );
}
