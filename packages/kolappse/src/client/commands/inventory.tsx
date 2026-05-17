import { useEffect, useMemo, useState } from "react";
import { Modal } from "../components/Modal";
import shared from "../shared.module.css";
import styles from "./inventory.module.css";
import { registerCommand } from "./registry";

type InventoryItem = { id: number; name: string; image: string; quantity: number };

type InventoryDialogProps = { onClose(): void };

export function InventoryDialog({ onClose }: InventoryDialogProps) {
  const [items, setItems] = useState<InventoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch("/_kolappse/api/inventory")
      .then((r) => r.json() as Promise<InventoryItem[]>)
      .then((data) => setItems(data.sort((a, b) => a.name.localeCompare(b.name))))
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Failed to load inventory"),
      );
  }, []);

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = query.toLowerCase();
    return q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items;
  }, [items, query]);

  return (
    <Modal title="Inventory Manager" onClose={onClose}>
      {error ? (
        <div className={`${shared.status} ${shared.error}`}>{error}</div>
      ) : !items ? (
        <div className={shared.status}>Loading…</div>
      ) : (
        <div className={styles.panel}>
          <input
            className={styles.search}
            placeholder={`Search ${items.length} items…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          {filtered.map((item) => (
            <div className={styles.item} key={item.id}>
              <img
                className={styles.itemImg}
                src={`https://images.kingdomofloathing.com/itemimages/${item.image}`}
                alt=""
              />
              <span className={styles.itemName}>{item.name}</span>
              <span className={styles.itemQty}>×{item.quantity}</span>
            </div>
          ))}
          {filtered.length === 0 && <div className={shared.status}>No items match.</div>}
        </div>
      )}
    </Modal>
  );
}

export function registerInventoryCommand(openDialog: (id: string) => void): void {
  registerCommand({
    id: "inventory",
    label: "Inventory Manager",
    keywords: ["inventory", "items", "backpack"],
    action: () => openDialog("inventory"),
  });
}
