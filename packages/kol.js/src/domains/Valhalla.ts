import type { Client, Result } from "../Client.js";

/**
 * Valhalla — afterlife.php, where you land between lives.
 *
 * Two things make this place unlike the rest of the game:
 *
 *   1. `api.php?what=status` returns an empty body here, so charpane.php is the
 *      only page carrying `pwd`. {@link Client} sniffs for that when it logs
 *      in, using the parsers below; they live here so that what Valhalla looks
 *      like is described in one file.
 *   2. Ascending is two POSTs. The first returns a confirmation page and starts
 *      nothing; only a second carrying `confirmascend=1` commits.
 */

export const Lifestyle = { Casual: 1, Softcore: 2, Hardcore: 3 } as const;
export type Lifestyle = (typeof Lifestyle)[keyof typeof Lifestyle];

export const Gender = { Male: 1, Female: 2 } as const;
export type Gender = (typeof Gender)[keyof typeof Gender];

export const MoonSign = {
  Mongoose: 1,
  Wallaby: 2,
  Vole: 3,
  Platypus: 4,
  Opossum: 5,
  Marmot: 6,
  Wombat: 7,
  Blender: 8,
  Packrat: 9,
  BadMoon: 10,
} as const;
export type MoonSign = (typeof MoonSign)[keyof typeof MoonSign];

/** The six classes the reincarnation form offers, by its own option values. */
export const StartingClass = {
  SealClubber: 1,
  TurtleTamer: 2,
  Pastamancer: 3,
  Sauceror: 4,
  DiscoBandit: 5,
  AccordionThief: 6,
} as const;
export type StartingClass = (typeof StartingClass)[keyof typeof StartingClass];

export type ValhallaPlace = "permery" | "deli" | "armory" | "reincarnate";

/**
 * What the Bureau of Reincarnation is currently offering. Ids only: path and
 * class names live in data-of-loathing, which kol.js already depends on, so
 * duplicating them here would just be a second list to keep in sync.
 */
export type ReincarnationOptions = {
  lifestyles: number[];
  classes: number[];
  genders: number[];
  signs: number[];
  paths: number[];
  /** The path the form pre-selects — currently Standard. */
  defaultPath: number | null;
};

/**
 * The confirmation step's echoed form. The acknowledgement checkboxes are
 * conditional — you only get `nopetok` if you skipped an astral pet, and so on
 * — so they are read off the page rather than assumed.
 */
export type AscensionConfirmation = {
  /** Hidden fields to echo back verbatim. */
  fields: Record<string, string>;
  /** Required "are you sure?" checkboxes, name to value. */
  acknowledgements: Record<string, string>;
  /** Prose summary of what is about to happen, useful for logging. */
  summary: string;
};

export type AscensionChoice = {
  lifestyle: Lifestyle;
  startingClass: StartingClass;
  gender: Gender;
  sign: MoonSign;
  path: number;
};

/** The `{image, text}` blurb the form previews a path with. */
export type PathDescription = { image: string; text: string };

/**
 * Values of a named `<select>`, skipping the zero-valued "- select a class -"
 * placeholders the form uses.
 */
function optionValues(html: string, selectName: string): number[] {
  const select = new RegExp(
    `<select[^>]*\\bname=['"]?${selectName}['"]?[^>]*>([\\s\\S]*?)</select>`,
    "i",
  ).exec(html);
  if (!select) return [];

  const values: number[] = [];
  for (const option of select[1].matchAll(/<option[^>]*value=['"]?(-?\d+)/gi)) {
    const value = Number(option[1]);
    if (value > 0) values.push(value);
  }
  return values;
}

export class Valhalla {
  #client: Client;

  constructor(client: Client) {
    this.#client = client;
  }

  /** Pass the Mini-Pearly Gates. Required once before Valhalla proper opens. */
  async enterPearlyGates(): Promise<{ karma: number | null }> {
    const html = await this.#client.fetchText("afterlife.php", {
      method: "GET",
      query: { action: "pearlygates" },
    });
    return { karma: Valhalla.parseKarma(html) };
  }

  async visit(place: ValhallaPlace): Promise<string> {
    return await this.#client.fetchText("afterlife.php", {
      method: "GET",
      query: { place },
    });
  }

  async getReincarnationOptions(): Promise<ReincarnationOptions> {
    return Valhalla.parseReincarnationOptions(await this.visit("reincarnate"));
  }

  /**
   * The form's own preview endpoint: the blurb and image for a path without
   * committing to it. The class and lifestyle only affect the wording.
   */
  async describePath(
    path: number,
    startingClass: StartingClass = StartingClass.SealClubber,
    lifestyle: Lifestyle = Lifestyle.Hardcore,
  ): Promise<PathDescription> {
    return await this.#client.fetchJson<PathDescription>("afterlife.php", {
      method: "GET",
      query: { info: 1, hc: lifestyle, playerclass: startingClass, path },
    });
  }

  /**
   * Step one of ascending: submit the choice and get back the confirmation
   * page. This does NOT start the run. Returns null if the game handed back
   * something other than a confirmation, which is how a refusal shows up.
   *
   * @throws if the choice is not a combination the game will accept
   */
  async proposeAscension(
    choice: AscensionChoice,
  ): Promise<AscensionConfirmation | null> {
    const problem = Valhalla.validate(choice);
    if (problem) throw new Error(problem);

    const html = await this.#client.fetchText("afterlife.php", {
      form: {
        action: "ascend",
        asctype: choice.lifestyle,
        whichclass: choice.startingClass,
        gender: choice.gender,
        whichsign: choice.sign,
        whichpath: choice.path,
      },
    });
    return Valhalla.parseAscendConfirmation(html);
  }

  /** Step two: commit. Irreversible — this starts the run. */
  async confirmAscension(confirmation: AscensionConfirmation): Promise<Result> {
    const html = await this.#client.fetchText("afterlife.php", {
      form: { ...confirmation.fields, ...confirmation.acknowledgements },
    });
    return Valhalla.parseAscendResult(html);
  }

  // --- pure parsers -------------------------------------------------------

  /**
   * Whether a charpane belongs to a spirit in Valhalla. The same two markers
   * KoLmafia looks for, in its order of preference.
   */
  static parseInValhalla(charpane: string): boolean {
    return (
      charpane.includes("otherimages/spirit.gif") ||
      charpane.includes("<br>Lvl. <img")
    );
  }

  /** The `pwd` api.php would normally supply. Only charpane.php has it here. */
  static parsePasswordHash(charpane: string): string | null {
    return (
      /var\s+pwdhash\s*=\s*["']([0-9a-f]+)["']/i.exec(charpane)?.[1] ?? null
    );
  }

  static parseKarma(html: string): number | null {
    const match = /You gain ([\d,]+) Karma/i.exec(html);
    return match ? Number(match[1].replace(/,/g, "")) : null;
  }

  static parseReincarnationOptions(html: string): ReincarnationOptions {
    const paths: number[] = [];
    let defaultPath: number | null = null;

    for (const radio of html.matchAll(
      /<input[^>]*\bname=["']?whichpath["']?[^>]*>/gi,
    )) {
      const value = /\bvalue=["']?(\d+)/i.exec(radio[0])?.[1];
      if (value === undefined) continue;
      paths.push(Number(value));
      if (/\bchecked\b/i.test(radio[0])) defaultPath = Number(value);
    }

    return {
      lifestyles: optionValues(html, "asctype"),
      classes: optionValues(html, "whichclass"),
      genders: optionValues(html, "gender"),
      signs: optionValues(html, "whichsign"),
      paths: [...new Set(paths)].sort((a, b) => a - b),
      defaultPath,
    };
  }

  /** Catches the mistakes that would otherwise start the wrong run. */
  static validate(choice: AscensionChoice): string | null {
    if (!Object.values(Lifestyle).includes(choice.lifestyle)) {
      return `invalid lifestyle ${choice.lifestyle}`;
    }
    if (!Object.values(StartingClass).includes(choice.startingClass)) {
      return `invalid class ${choice.startingClass}`;
    }
    if (!Object.values(Gender).includes(choice.gender)) {
      return `invalid gender ${choice.gender}`;
    }
    if (!Object.values(MoonSign).includes(choice.sign)) {
      return `invalid moon sign ${choice.sign}`;
    }
    if (!Number.isInteger(choice.path) || choice.path < 0) {
      return `invalid path ${choice.path}`;
    }
    // The form drops the Bad Moon option unless you are on no path at all.
    if (choice.sign === MoonSign.BadMoon && choice.path !== 0) {
      return "Bad Moon can only be taken on an unrestricted path";
    }
    return null;
  }

  /**
   * Reads the confirmation form back into the exact second POST the game wants.
   * Returns null when the page is not a confirmation.
   */
  static parseAscendConfirmation(html: string): AscensionConfirmation | null {
    const form = /<form[^>]*id=["']?confirmascend["']?[\s\S]*?<\/form>/i.exec(
      html,
    )?.[0];
    if (!form) return null;

    const fields: Record<string, string> = {};
    const acknowledgements: Record<string, string> = {};

    for (const input of form.matchAll(/<input[^>]*>/gi)) {
      const tag = input[0];
      const name = /\bname=["']?([a-z0-9_[\]]+)/i.exec(tag)?.[1];
      if (!name) continue;
      const value = /\bvalue=["']?([^"'\s>]*)/i.exec(tag)?.[1] ?? "";

      if (/type=["']?checkbox/i.test(tag)) {
        // Only the boxes the game marks required have to be ticked.
        if (/class=["'][^"']*\breq\b/i.test(tag))
          acknowledgements[name] = value || "1";
      } else if (/type=["']?hidden/i.test(tag)) {
        fields[name] = value;
      }
    }

    if (!("confirmascend" in fields)) return null;

    const text = html
      .replace(/<[^>]+>/g, " ")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, " ");
    const summary =
      /You are about to step into[\s\S]{0,400}?Path\./i.exec(text)?.[0] ?? "";

    return { fields, acknowledgements, summary: summary.trim() };
  }

  static parseAscendResult(html: string): Result {
    // Being handed the form back means nothing happened.
    if (/name=ascform/i.test(html)) {
      return { success: false, reason: "still on the reincarnation form" };
    }
    if (/Valhalla|Beyond the Pale/i.test(html) && !/Welcome back/i.test(html)) {
      return { success: false, reason: "still in Valhalla" };
    }
    return { success: true };
  }
}
