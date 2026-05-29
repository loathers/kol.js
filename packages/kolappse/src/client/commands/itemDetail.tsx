import { decodeHTML } from "entities";
import { useEffect, useState } from "react";

import shared from "../shared.module.css";
import styles from "./itemDetail.module.css";

type EffectGrant = { effect: string; duration: number };

type SerializedModifier =
  | { name: string; kind: "numeric"; value: number }
  | { name: string; kind: "boolean"; value: boolean }
  | { name: string; kind: "string"; value: string }
  | { name: string; kind: "string[]"; values: string[] }
  | { name: string; kind: "effect-grants"; grants: EffectGrant[] }
  | { name: string; kind: "range"; min: number; max: number };

type EquipmentInfo = {
  power: number;
  type: string | null;
  hands: number | null;
  musRequirement: number;
  mysRequirement: number;
  moxRequirement: number;
};

type ConsumableInfo = {
  stomach: number;
  liver: number;
  spleen: number;
  levelRequirement: number;
  quality: string | null;
  adventureRange: string;
  notes: string | null;
};

type ItemDetail = {
  id: number;
  name: string;
  image: string;
  uses: string[];
  equipment: EquipmentInfo | null;
  consumable: ConsumableInfo | null;
  modifiers: SerializedModifier[];
};

type ItemDetailViewProps = {
  itemId: number;
  onClose(): void;
};

export function ItemDetailView({ itemId }: ItemDetailViewProps) {
  const [item, setItem] = useState<ItemDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/_kolappse/api/item?id=${itemId}`)
      .then((r) => r.json() as Promise<ItemDetail>)
      .then(setItem)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Failed to load item"),
      );
  }, [itemId]);

  if (error)
    return <div className={`${shared.status} ${shared.error}`}>{error}</div>;
  if (!item) return <div className={shared.status}>Loading…</div>;

  const effectGrants = item.modifiers.find(
    (m): m is Extract<SerializedModifier, { kind: "effect-grants" }> =>
      m.kind === "effect-grants" && m.name === "Effect",
  )?.grants ?? [];

  const displayModifiers = item.modifiers.filter(
    (m) => m.name !== "Effect" && m.name !== "Effect Duration",
  );

  return (
    <div className={styles.detail}>
      <div className={styles.header}>
        <img
          className={styles.img}
          src={`https://d2uyhvukfffg5a.cloudfront.net/itemimages/${item.image}`}
          alt=""
        />
        <div>
          <div className={styles.name}>{decodeHTML(item.name)}</div>
          <div className={styles.uses}>{item.uses.join(", ")}</div>
        </div>
      </div>

      {item.equipment && (
        <Section title="Equipment">
          {item.equipment.power > 0 && (
            <Row label="Power" value={item.equipment.power} />
          )}
          {item.equipment.type && (
            <Row label="Type" value={item.equipment.type} />
          )}
          {item.equipment.hands != null && (
            <Row label="Hands" value={item.equipment.hands} />
          )}
          {item.equipment.musRequirement > 0 && (
            <Row label="Mus req." value={item.equipment.musRequirement} />
          )}
          {item.equipment.mysRequirement > 0 && (
            <Row label="Mys req." value={item.equipment.mysRequirement} />
          )}
          {item.equipment.moxRequirement > 0 && (
            <Row label="Mox req." value={item.equipment.moxRequirement} />
          )}
        </Section>
      )}

      {item.consumable && (
        <Section title="Consumable">
          {item.consumable.stomach > 0 && (
            <Row label="Fullness" value={item.consumable.stomach} />
          )}
          {item.consumable.liver > 0 && (
            <Row label="Drunkenness" value={item.consumable.liver} />
          )}
          {item.consumable.spleen > 0 && (
            <Row label="Spleen" value={item.consumable.spleen} />
          )}
          {item.consumable.levelRequirement > 0 && (
            <Row label="Level req." value={item.consumable.levelRequirement} />
          )}
          {item.consumable.quality && (
            <Row label="Quality" value={item.consumable.quality} />
          )}
          <Row label="Adventures" value={item.consumable.adventureRange} />
          {item.consumable.notes && (
            <Row label="Notes" value={item.consumable.notes} />
          )}
        </Section>
      )}

      {effectGrants.length > 0 && (
        <Section title="Grants effect">
          {effectGrants.map((g) => (
            <Row
              key={g.effect}
              label={g.effect}
              value={g.duration > 0 ? `${g.duration} turns` : ""}
            />
          ))}
        </Section>
      )}

      {displayModifiers.length > 0 && (
        <Section title="Modifiers">
          {displayModifiers.map((mod) => (
            <Row key={mod.name} label={mod.name} value={formatModifier(mod)} />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>{title}</div>
      <div className={styles.rows}>{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <span className={styles.rowValue}>{value}</span>
    </div>
  );
}

function formatModifier(mod: SerializedModifier): string {
  switch (mod.kind) {
    case "numeric":
      return mod.value > 0 ? `+${mod.value}` : String(mod.value);
    case "boolean":
      return mod.value ? "Yes" : "No";
    case "string":
      return mod.value;
    case "string[]":
      return mod.values.join(", ");
    case "range":
      return `${mod.min}–${mod.max}`;
    case "effect-grants":
      return mod.grants.map((g) => g.effect).join(", ");
  }
}
