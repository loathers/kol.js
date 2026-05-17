import { useRef, type ComponentType } from "react";
import styles from "./Panel.module.css";

export type PanelRect = { top: number; left: number; width: number; height: number };

type PanelProps = {
  id: string;
  title: string;
  icon?: string;
  View: ComponentType<{ onClose(): void }>;
  zIndex: number;
  initialRect?: PanelRect;
  onClose(): void;
  onFocus(): void;
  onMinimize(rect: PanelRect): void;
};

export function Panel({ title, View, zIndex, initialRect, onClose, onFocus, onMinimize }: PanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  function onMouseDown(e: React.MouseEvent) {
    if (!panelRef.current) return;
    onFocus();
    const rect = panelRef.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    function onMove(e: MouseEvent) {
      if (!panelRef.current) return;
      panelRef.current.style.left = `${e.clientX - offsetX}px`;
      panelRef.current.style.top = `${e.clientY - offsetY}px`;
      panelRef.current.style.transform = "none";
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  function handleMinimize() {
    const rect = panelRef.current?.getBoundingClientRect();
    onMinimize(
      rect
        ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
        : { top: window.innerHeight * 0.15, left: (window.innerWidth - 520) / 2, width: 520, height: 400 },
    );
  }

  const placedStyle: React.CSSProperties = initialRect
    ? { top: initialRect.top, left: initialRect.left, width: initialRect.width, height: initialRect.height, transform: "none" }
    : {};

  return (
    <div
      className={styles.panel}
      ref={panelRef}
      style={{ zIndex, ...placedStyle }}
      onMouseDownCapture={onFocus}
    >
      <div className={styles.header} onMouseDown={onMouseDown}>
        <span className={styles.title}>{title}</span>
        <div className={styles.controls}>
          <button className={styles.btn} onClick={handleMinimize} title="Minimize">_</button>
          <button className={styles.btn} onClick={onClose} title="Close">x</button>
        </div>
      </div>
      <div className={styles.body}>
        <View onClose={onClose} />
      </div>
    </div>
  );
}
