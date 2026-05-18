import { decodeHTML } from "entities";
import { useEffect, useMemo, useState } from "react";

import shared from "../shared.module.css";
import styles from "./inventory.module.css";
import { registerCommand } from "./registry";

type InventoryItem = {
  id: number;
  name: string;
  image: string;
  quantity: number;
};

type InventoryViewProps = { onClose(): void };

export function InventoryView({ onClose: _ }: InventoryViewProps) {
  const [items, setItems] = useState<InventoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch("/_kolappse/api/inventory")
      .then((r) => r.json() as Promise<InventoryItem[]>)
      .then((data) =>
        setItems(data.sort((a, b) => a.name.localeCompare(b.name))),
      )
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Failed to load inventory"),
      );
  }, []);

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = query.toLowerCase();
    return q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items;
  }, [items, query]);

  if (error)
    return <div className={`${shared.status} ${shared.error}`}>{error}</div>;
  if (!items) return <div className={shared.status}>Loading…</div>;

  return (
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
            src={`https://d2uyhvukfffg5a.cloudfront.net/itemimages/${item.image}`}
            alt=""
          />
          <span className={styles.itemName}>{decodeHTML(item.name)}</span>
          <span className={styles.itemQty}>x {item.quantity}</span>
        </div>
      ))}
      {filtered.length === 0 && (
        <div className={shared.status}>No items match.</div>
      )}
    </div>
  );
}

export function registerInventoryCommand(): void {
  registerCommand({
    id: "inventory",
    label: "Inventory Manager",
    icon: "I",
    keywords: ["inventory", "items", "backpack"],
    view: InventoryView,
  });
}
