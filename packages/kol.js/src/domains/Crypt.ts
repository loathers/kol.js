import type { Client } from "../Client.js";

/**
 * crypt.php — which corners of the Cyrpt are still defiled.
 *
 * The quest log gives one number, "Evilometer: X", for the whole Cyrpt, so
 * nothing in it says which of the four corners is clear. The Haert opens only
 * when all four are, which makes the Haert unreachable for anything relying on
 * the log alone: its prerequisites can never be marked done.
 *
 * The map draws a different image per corner depending on whether it is
 * cleared, and reading it costs no turn and no item.
 */

export type CryptState = {
  nook: boolean;
  niche: boolean;
  cranny: boolean;
  alcove: boolean;
  /** True once all four are clear and the Haert of the Cyrpt is open. */
  haertOpen: boolean;
};

/** Which quadrant image belongs to which corner. */
const CORNERS = {
  nook: "ul",
  niche: "ur",
  cranny: "ll",
  alcove: "lr",
} as const;

export function parseCrypt(html: string): CryptState | null {
  // A page that is not the Cyrpt map tells us nothing, and saying "all clear"
  // because no corner image was found would open the Haert by accident.
  if (!/cyrpt\//i.test(html)) return null;

  const cleared = (corner: string): boolean =>
    !new RegExp(`cyrpt/${corner}\\.gif`, "i").test(html);

  const haertOpen = /cyrpt\/thecrypt_heart\.gif/i.test(html);

  // The heart image replaces the four corners once they are all clear, so the
  // corners read as cleared either way; this just makes that explicit.
  if (haertOpen) {
    return {
      nook: true,
      niche: true,
      cranny: true,
      alcove: true,
      haertOpen: true,
    };
  }

  return {
    nook: cleared(CORNERS.nook),
    niche: cleared(CORNERS.niche),
    cranny: cleared(CORNERS.cranny),
    alcove: cleared(CORNERS.alcove),
    haertOpen: false,
  };
}

export class Crypt {
  #client: Client;

  constructor(client: Client) {
    this.#client = client;
  }

  /** Which corners are clear, or null if the Cyrpt is not open. */
  async getState(): Promise<CryptState | null> {
    return parseCrypt(
      await this.#client.fetchText("crypt.php", { method: "GET" }),
    );
  }
}
