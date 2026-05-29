import { Command } from "cmdk";
import { decodeHTML } from "entities";
import { useEffect, useState } from "react";

import { useLayerContext } from "../components/CommandPalette";
import shared from "../shared.module.css";
import { ItemDetailView } from "./itemDetail";
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
  const { pushLayer } = useLayerContext();
  const [items, setItems] = useState<InventoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  if (error)
    return <div className={`${shared.status} ${shared.error}`}>{error}</div>;
  if (!items) return <div className={shared.status}>Loading…</div>;

  function openItem(item: InventoryItem) {
    pushLayer({
      title: decodeHTML(item.name),
      View: ({ onClose: c }) => <ItemDetailView itemId={item.id} onClose={c} />,
    });
  }

  return (
    <Command className={styles.panel}>
      <Command.Input
        className={styles.search}
        placeholder={`Search ${items.length} items…`}
        autoFocus
      />
      <Command.List className={styles.list}>
        <Command.Empty className={shared.status}>No items match.</Command.Empty>
        {items.map((item) => (
          <Command.Item
            key={item.id}
            value={item.name}
            className={styles.item}
            onSelect={() => openItem(item)}
          >
            <img
              className={styles.itemImg}
              src={`https://d2uyhvukfffg5a.cloudfront.net/itemimages/${item.image}`}
              alt=""
            />
            <span className={styles.itemName}>{decodeHTML(item.name)}</span>
            <span className={styles.itemQty}>x {item.quantity}</span>
          </Command.Item>
        ))}
      </Command.List>
    </Command>
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
