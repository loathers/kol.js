import { useEffect, useRef, type ReactNode } from "react";
import styles from "./Modal.module.css";

type ModalProps = {
  title: string;
  onClose(): void;
  children: ReactNode;
};

export function Modal({ title, onClose, children }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function onMouseDown(e: React.MouseEvent) {
    if (!modalRef.current) return;
    const rect = modalRef.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    function onMove(e: MouseEvent) {
      if (!modalRef.current) return;
      modalRef.current.style.left = `${e.clientX - offsetX}px`;
      modalRef.current.style.top = `${e.clientY - offsetY}px`;
      modalRef.current.style.transform = "none";
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  return (
    <div className={styles.backdrop}>
      <div className={styles.modal} ref={modalRef}>
        <div className={styles.header} onMouseDown={onMouseDown}>
          <span className={styles.title}>{title}</span>
          <button className={styles.close} onClick={onClose}>✕</button>
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  );
}
