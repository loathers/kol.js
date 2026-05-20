import { Item } from "data-of-loathing";

import type { Client, Result } from "../Client.js";
import { gameData } from "../GameData.js";
import { registerInterceptor } from "../interceptors/registry.js";
import type { KolRequest } from "../interceptors/types.js";
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

type AccessorySlotNumber = 1 | 2 | 3;

const ACCESSORY_SLOT_NUMBER: Partial<Record<EquipmentSlot, AccessorySlotNumber>> = {
  acc1: 1,
  acc2: 2,
  acc3: 3,
};

function slotForItem(item: Item, accessorySlotNumber: AccessorySlotNumber = 1): EquipmentSlot | null {
  for (const use of item.uses) {
    if (use === "hat") return "hat";
    if (use === "shirt") return "shirt";
    if (use === "pants") return "pants";
    if (use === "weapon") return "weapon";
    if (use === "offhand") return "offhand";
    if (use === "container") return "container";
    if (use === "accessory") return `acc${accessorySlotNumber}`;
  }
  return null;
}

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

  async unequip(slot: EquipmentSlot): Promise<void> {
    await this.#client.fetchText("inv_equip.php", {
      query: { which: 2, action: "unequip", type: slot },
    });
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
      return { success: true };
    }
    return { success: false, reason: "Failed to equip item" };
  }
}

// Intercept equip/unequip actions from the browser UI and emit the same events
// so that Inventory and other listeners stay in sync regardless of who initiated the action.

async function onEquipResponse(client: Client, req: KolRequest): Promise<void> {
  const itemId = parseInt(req.params.get("whichitem") ?? "", 10);
  if (isNaN(itemId)) return;
  const item = await gameData.findItemById(itemId);
  if (!item) return;
  const accessorySlotNumber = (parseInt(req.params.get("slot") ?? "1", 10) || 1) as AccessorySlotNumber;
  const slot = slotForItem(item, accessorySlotNumber);
  if (!slot) return;
  client.equipment.get.invalidate();
  void client.emit("equip", { item, slot });
}

async function onUnequipResponse(client: Client, req: KolRequest): Promise<void> {
  const slot = req.params.get("type") as EquipmentSlot | null;
  if (!slot) return;
  const item = (await client.equipment.get()).get(slot);
  client.equipment.get.invalidate();
  if (item) void client.emit("unequip", { item, slot });
}

registerInterceptor({
  path: "inv_equip.php",
  onResponse(client, req) {
    const action = req.params.get("action");
    if (action === "equip") return onEquipResponse(client, req);
    if (action === "unequip") return onUnequipResponse(client, req);
  },
});
