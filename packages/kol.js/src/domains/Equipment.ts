import { Item } from "data-of-loathing";

import type { Client, Result } from "../Client.js";
import { gameData } from "../GameData.js";
import { cached } from "../utils/cached.js";
import { resolveEntityId } from "../utils/utils.js";
import type { ApiStatus } from "./ApiStatus.js";

export type EquipmentSlot =
  | "hat"
  | "shirt"
  | "pants"
  | "weapon"
  | "offhand"
  | "acc1"
  | "acc2"
  | "acc3"
  | "container"
  | "cardsleeve"
  | "sticker1"
  | "sticker2"
  | "sticker3"
  | "folder1"
  | "folder2"
  | "folder3"
  | "folder4"
  | "folder5";

export type EquipmentMap = Map<EquipmentSlot, Item>;

type ParsedEntry = { slot: EquipmentSlot; id: number };

const ACCESSORY_SLOT_NUMBER: Partial<Record<EquipmentSlot, number>> = {
  acc1: 1,
  acc2: 2,
  acc3: 3,
};

export class Equipment {
  #client: Client;

  constructor(client: Client) {
    this.#client = client;
    client.on("apiStatus", async (status) => {
      this.get.setValue(await Equipment.buildMap(status));
    });
  }

  static parseEntries(status: ApiStatus): ParsedEntry[] {
    const eq = status.equipment;
    if (!eq) return [];
    const main: Array<readonly [EquipmentSlot, number]> = [
      ["hat", eq.hat],
      ["shirt", eq.shirt],
      ["pants", eq.pants],
      ["weapon", eq.weapon],
      ["offhand", eq.offhand],
      ["acc1", eq.acc1],
      ["acc2", eq.acc2],
      ["acc3", eq.acc3],
      ["container", eq.container],
      ["cardsleeve", eq.cardsleeve],
      ...status.stickers.map(
        (id, i) => [`sticker${i + 1}` as EquipmentSlot, id] as const,
      ),
      ...status.folder_holder.map(
        (id, i) => [`folder${i + 1}` as EquipmentSlot, id] as const,
      ),
    ];
    return main
      .filter(([, id]) => id > 0)
      .map(([slot, id]) => ({ slot, id }));
  }

  static async buildMap(status: ApiStatus): Promise<Map<EquipmentSlot, Item>> {
    const entries = Equipment.parseEntries(status);
    const items = await gameData.findItemsByIds(entries.map((e) => e.id));
    const byId = new Map(items.map((item) => [item.id, item]));
    return new Map(
      entries.flatMap(({ slot, id }) => {
        const item = byId.get(id);
        return item ? [[slot, item]] : [];
      }),
    );
  }

  get = cached(async (): Promise<Map<EquipmentSlot, Item>> => {
    const status = await this.#client.fetchStatus();
    return Equipment.buildMap(status);
  });

  async getSlot(slot: EquipmentSlot): Promise<Item | null> {
    return (await this.get()).get(slot) ?? null;
  }

  async equip(item: Item | number, slot?: EquipmentSlot): Promise<Result> {
    const slotNumber = slot !== undefined ? ACCESSORY_SLOT_NUMBER[slot] : undefined;
    const html = await this.#client.fetchText("inv_equip.php", {
      method: "POST",
      form: {
        action: "equip",
        which: 2,
        ajax: 1,
        whichitem: resolveEntityId(item),
        ...(slotNumber !== undefined && { slot: slotNumber }),
      },
    });
    if (
      html.includes("You equip an item") ||
      html.includes("Item equipped") ||
      html.includes("equips an item")
    ) {
      this.get.invalidate();
      return { success: true };
    }
    return { success: false, reason: "Failed to equip item" };
  }
}
