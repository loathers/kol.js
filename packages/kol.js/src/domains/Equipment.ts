import { Item, ItemUse } from "data-of-loathing";

import type { Client } from "../Client.js";
import { gameData } from "../GameData.js";
import { type ActionResult, defineAction } from "../interceptors/action.js";
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

const ACCESSORY_SLOT_NUMBER: Partial<
  Record<EquipmentSlot, AccessorySlotNumber>
> = {
  acc1: 1,
  acc2: 2,
  acc3: 3,
};

function slotForItem(
  item: Item,
  accessorySlotNumber: AccessorySlotNumber = 1,
): EquipmentSlot | null {
  for (const use of item.uses) {
    if (use === ItemUse.Hat) return "hat";
    if (use === ItemUse.Shirt) return "shirt";
    if (use === ItemUse.Pants) return "pants";
    if (use === ItemUse.Weapon) return "weapon";
    if (use === ItemUse.Offhand) return "offhand";
    if (use === ItemUse.Container) return "container";
    if (use === ItemUse.Accessory) return `acc${accessorySlotNumber}`;
  }
  return null;
}

type EquipData = { item: Item; slot: EquipmentSlot };

const equipAction = defineAction({
  path: "inv_equip.php",
  matches: (req) => req.params.get("action") === "equip",
  async parse({ req, body, success, failure }) {
    if (
      !body.includes("You equip an item") &&
      !body.includes("Item equipped") &&
      !body.includes("equips an item")
    ) {
      return failure("Failed to equip item");
    }
    const itemId = parseInt(req.params.get("whichitem") ?? "", 10);
    const item = isNaN(itemId) ? null : await gameData.findItemById(itemId);
    if (!item) return failure("Item not found");
    const accSlot = (parseInt(req.params.get("slot") ?? "1", 10) ||
      1) as AccessorySlotNumber;
    const slot = slotForItem(item, accSlot);
    if (!slot) return failure("Could not determine slot");
    return success({ item, slot });
  },
  onSuccess({ client, result }) {
    client.equipment.get.invalidate();
    void client.emit("equip", { item: result.item, slot: result.slot });
  },
});

const unequipAction = defineAction({
  path: "inv_equip.php",
  matches: (req) => req.params.get("action") === "unequip",
  async parse({ req, client, success, failure }) {
    const slot = req.params.get("type") as EquipmentSlot | null;
    if (!slot) return failure("No slot specified");
    // Read from cache before it's invalidated in onSuccess
    const item = (await client.equipment.get()).get(slot);
    if (!item) return failure("No item in slot");
    return success({ item, slot });
  },
  onSuccess({ client, result }) {
    client.equipment.get.invalidate();
    client.inventory.get.invalidate();
    void client.emit("unequip", { item: result.item, slot: result.slot });
  },
});

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
    return main.filter(([, id]) => id > 0).map(([slot, id]) => ({ slot, id }));
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

  async equip(
    item: Item | number,
    slot?: EquipmentSlot,
  ): Promise<ActionResult<EquipData>> {
    const slotNumber =
      slot !== undefined ? ACCESSORY_SLOT_NUMBER[slot] : undefined;
    return equipAction(this.#client, {
      method: "POST",
      form: {
        action: "equip",
        which: 2,
        ajax: 1,
        whichitem: resolveEntityId(item),
        ...(slotNumber !== undefined && { slot: slotNumber }),
      },
    });
  }

  async unequip(slot: EquipmentSlot): Promise<ActionResult<EquipData>> {
    return unequipAction(this.#client, {
      query: { which: 2, action: "unequip", type: slot },
    });
  }
}
