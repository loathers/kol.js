import { registerInterceptor } from "./registry.js";

/**
 * KoL announces a gain in a fixed shape: "You acquire an item: <b>x</b>" for
 * one, "You acquire <b>3 x</b>" for several. Matched case-sensitively, because
 * pages like the reincarnation form carry prose "you acquire" that means
 * nothing.
 */
const ACQUIRED_ITEM = /You acquire (?:an item:|<b>\d)/;
const ACQUIRED_EFFECT = /You acquire an (?:effect|intrinsic):/;

/**
 * Drop the caches any response says are now wrong. The alternative is every
 * action knowing what it mutates, which fails for the ones nobody thought of —
 * a choice adventure that hands you an item leaves the inventory stale, and a
 * caller re-reads it and sees the world as it was before.
 */
registerInterceptor({
  onResponse(client, req, res) {
    if (typeof res.body !== "string") return;
    if (ACQUIRED_ITEM.test(res.body)) client.inventory.get.invalidate();
    if (ACQUIRED_EFFECT.test(res.body)) client.effects.get.invalidate();
    // Outfits and choice adventures change equipment without going through
    // the equip/unequip actions.
    if (req.path === "inv_equip.php") client.equipment.get.invalidate();
  },
});
