import type { AscensionClass } from "data-of-loathing";
import { decodeHTML } from "entities";

import type { Client, Result } from "../Client.js";
import { parseKoLNumber, resolveEntityId } from "../utils/utils.js";
import { Gender, genderFromId, genderId } from "./Gender.js";
import { Lifestyle, lifestyleFromId, lifestyleId } from "./Lifestyle.js";
import { MoonSign, moonSignFromId, moonSignId } from "./MoonSign.js";

/** Valhalla, afterlife.php. api.php is empty here. charpane.php has `pwd`. */

export type ValhallaPlace = "permery" | "deli" | "armory" | "reincarnate";

/** Classes and paths stay ids. data-of-loathing has the names. */
export type ReincarnationOptions = {
  lifestyles: Lifestyle[];
  classes: number[];
  genders: Gender[];
  signs: MoonSign[];
  paths: number[];
  defaultPath: number | null;
};

/** Acknowledgements are conditional, so read off the page. */
export type AscensionConfirmation = {
  fields: Record<string, string>;
  acknowledgements: Record<string, string>;
  summary: string;
};

export type AscensionChoice = {
  lifestyle: Lifestyle;
  class: AscensionClass | number;
  gender: Gender;
  sign: MoonSign;
  path: number;
};

export type PathDescription = { image: string; text: string };

export type AstralOffer = { item: number; descId: number; name: string };

const VENDOR_ACTIONS: Partial<Record<ValhallaPlace, string>> = {
  deli: "buydeli",
  armory: "buyarmory",
};

/** Values of a `<select>`, less the zero placeholder. */
function optionValues(html: string, selectName: string): number[] {
  const select = new RegExp(
    `<select[^>]*\\bname=['"]?${selectName}['"]?[^>]*>([\\s\\S]*?)</select>`,
    "i",
  ).exec(html);
  if (!select) return [];

  const values: number[] = [];
  for (const option of select[1].matchAll(/<option[^>]*value=['"]?(\d+)/gi)) {
    const value = Number(option[1]);
    if (value > 0) values.push(value);
  }
  return values;
}

/** Drops ids we have no name for. */
function named<T>(ids: number[], fromId: (id: number) => T | null): T[] {
  return ids.flatMap((id) => {
    const value = fromId(id);
    return value ? [value] : [];
  });
}

export class Valhalla {
  #client: Client;

  constructor(client: Client) {
    this.#client = client;
  }

  /** Required once before Valhalla proper opens. */
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

  async getAstralOffers(place: ValhallaPlace): Promise<AstralOffer[]> {
    return Valhalla.parseAstralOffers(await this.visit(place));
  }

  /** @throws if the place is not a Karma vendor */
  async buyAstral(
    place: ValhallaPlace,
    item: AstralOffer | number,
  ): Promise<Result> {
    const action = VENDOR_ACTIONS[place];
    if (!action) throw new Error(`${place} is not a Karma vendor`);

    const html = await this.#client.fetchText("afterlife.php", {
      method: "GET",
      query: {
        action,
        whichitem: typeof item === "number" ? item : item.item,
      },
    });
    return Valhalla.parseAstralPurchase(html);
  }

  async getReincarnationOptions(): Promise<ReincarnationOptions> {
    return Valhalla.parseReincarnationOptions(await this.visit("reincarnate"));
  }

  /** Class and lifestyle only affect the wording. */
  async describePath(
    path: number,
    playerClass: AscensionClass | number = 1,
    lifestyle: Lifestyle = Lifestyle.Hardcore,
  ): Promise<PathDescription> {
    return await this.#client.fetchJson<PathDescription>("afterlife.php", {
      method: "GET",
      query: {
        info: 1,
        hc: lifestyleId(lifestyle),
        playerclass: resolveEntityId(playerClass),
        path,
      },
    });
  }

  /** @throws if the game will not accept the choice */
  async ascend(choice: AscensionChoice): Promise<Result> {
    const confirmation = await this.proposeAscension(choice);
    if (!confirmation) {
      return { success: false, reason: "the game offered no confirmation" };
    }
    return await this.confirmAscension(confirmation);
  }

  /**
   * Does not start the run. Null is a refusal.
   *
   * @throws if the game will not accept the choice
   */
  async proposeAscension(
    choice: AscensionChoice,
  ): Promise<AscensionConfirmation | null> {
    const problem = Valhalla.validate(choice);
    if (problem) throw new Error(problem);

    const html = await this.#client.fetchText("afterlife.php", {
      form: {
        action: "ascend",
        asctype: lifestyleId(choice.lifestyle),
        whichclass: resolveEntityId(choice.class),
        gender: genderId(choice.gender),
        whichsign: moonSignId(choice.sign),
        whichpath: choice.path,
      },
    });
    return Valhalla.parseAscendConfirmation(html);
  }

  async confirmAscension(confirmation: AscensionConfirmation): Promise<Result> {
    const html = await this.#client.fetchText("afterlife.php", {
      form: { ...confirmation.fields, ...confirmation.acknowledgements },
    });
    return Valhalla.parseAscendResult(html);
  }

  static parseInValhalla(charpane: string): boolean {
    return (
      charpane.includes("otherimages/spirit.gif") ||
      charpane.includes("<br>Lvl. <img")
    );
  }

  static parsePasswordHash(charpane: string): string | null {
    return (
      /var\s+pwdhash\s*=\s*["']([0-9a-f]+)["']/i.exec(charpane)?.[1] ?? null
    );
  }

  static parsePlayerId(charpane: string): string | null {
    return /var\s+playerid\s*=\s*(\d+)/i.exec(charpane)?.[1] ?? null;
  }

  static parseKarma(html: string): number | null {
    const match = /You gain ([\d,]+) Karma/i.exec(html);
    return match ? parseKoLNumber(match[1]) : null;
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
      lifestyles: named(optionValues(html, "asctype"), lifestyleFromId),
      classes: optionValues(html, "whichclass"),
      genders: named(optionValues(html, "gender"), genderFromId),
      signs: named(optionValues(html, "whichsign"), moonSignFromId),
      paths: paths.sort((a, b) => a - b),
      defaultPath,
    };
  }

  static validate(choice: AscensionChoice): string | null {
    if (!Object.values(Lifestyle).includes(choice.lifestyle)) {
      return `invalid lifestyle ${choice.lifestyle}`;
    }
    // The live set is getReincarnationOptions().classes. This only rules out 0.
    const classId = resolveEntityId(choice.class);
    if (!Number.isInteger(classId) || classId < 1) {
      return `invalid class ${classId}`;
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
    // The form only offers Bad Moon on no path at all.
    if (choice.sign === MoonSign.BadMoon && choice.path !== 0) {
      return "Bad Moon can only be taken on an unrestricted path";
    }
    return null;
  }

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
        // Only the boxes marked required have to be ticked.
        if (/class=["'][^"']*\breq\b/i.test(tag))
          acknowledgements[name] = value || "1";
      } else if (/type=["']?hidden/i.test(tag)) {
        fields[name] = value;
      }
    }

    if (!("confirmascend" in fields)) return null;

    // cleanString() drops tags without a separator.
    const text = decodeHTML(html)
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ");
    const summary =
      /You are about to step into[\s\S]{0,400}?Path\./i.exec(text)?.[0] ?? "";

    return { fields, acknowledgements, summary: summary.trim() };
  }

  /** Only the name's descitem() sits with the whichitem that buys it. */
  static parseAstralOffers(html: string): AstralOffer[] {
    const pattern =
      /<span onclick=['"]?descitem\((\d+)\)['"]?>([^<]*)<[\s\S]*?name=["']?whichitem["']? value=["']?(\d+)/gi;

    const offers: AstralOffer[] = [];
    for (const match of html.matchAll(pattern)) {
      offers.push({
        descId: Number(match[1]),
        name: decodeHTML(match[2]).trim(),
        item: Number(match[3]),
      });
    }
    return offers;
  }

  static parseAstralPurchase(html: string): Result {
    if (/You acquire an item/i.test(html)) return { success: true };
    if (/don't have enough/i.test(html)) {
      return { success: false, reason: "not enough Karma" };
    }
    return { success: false, reason: "unrecognised response to the purchase" };
  }

  static parseAscendResult(html: string): Result {
    // A page we cannot place is a failure, not a success.
    if (/Welcome back/i.test(html)) return { success: true };
    if (/name=ascform/i.test(html)) {
      return { success: false, reason: "still on the reincarnation form" };
    }
    // The art stays even where the heading changes.
    const stillUpHere =
      /Beyond the Pale/i.test(html) || html.includes("otherimages/valhalla/");
    if (stillUpHere) {
      return { success: false, reason: "still in Valhalla" };
    }
    return {
      success: false,
      reason: "unrecognised response to the confirmation",
    };
  }
}
