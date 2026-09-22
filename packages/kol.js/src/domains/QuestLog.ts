import { decodeHTML } from "entities";

import type { Client } from "../Client.js";

/**
 * questlog.php — what the game says about each quest the character has.
 *
 * The log shows a quest only while it is active, so a quest missing from the
 * current tab is either not yet handed out or already finished; the completed
 * tab is what tells the two apart.
 */

export type QuestLogEntry = {
  /** The heading this quest sits under, e.g. "Council Quests". */
  section: string;
  title: string;
  /** The quest's current step, as the plain text the game wrote it in. */
  text: string;
};

/**
 * A quest's own heading, which the game writes as a bolded title followed by a
 * line break. Section headings are bold too, but are followed by a blockquote
 * rather than a break, so this tells the two apart without a list of either.
 */
const ENTRY = /<b>([^<]+)<\/b>\s*<br\s*\/?>/gi;

/** A section heading: bold, ends in a colon, and opens a blockquote. */
const SECTION = /<b>([^<]+):<\/b>\s*<blockquote>/gi;

/**
 * Quest log markup reduced to the plain text the game's own prose reads as.
 *
 * Stripping tags alone is not enough. The log bolds things inside a sentence —
 * `the Nearby Plains<b>.</b>` — so a naive strip leaves `the Nearby Plains .`,
 * which no longer matches the step word for word. Anything comparing a quest's
 * step against a stored string breaks on exactly that.
 */
export function questLogText(html: string): string {
  return decodeHTML(html.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
}

export class QuestLog {
  #client: Client;

  constructor(client: Client) {
    this.#client = client;
  }

  /** Quests currently in progress. */
  async getActive(): Promise<QuestLogEntry[]> {
    return QuestLog.parse(await this.#fetch(1));
  }

  /** Quests already finished this ascension. */
  async getCompleted(): Promise<QuestLogEntry[]> {
    return QuestLog.parse(await this.#fetch(2));
  }

  async #fetch(which: 1 | 2): Promise<string> {
    return this.#client.fetchText("questlog.php", {
      method: "GET",
      query: { which },
    });
  }

  /**
   * Find a quest by title, case-insensitively.
   *
   * The game's casing is not what anything else writes down: the log says
   * "Am I My Trapper's Keeper?" where quest tables commonly write "my".
   * Matching exactly means never finding the quest at all.
   */
  static find(entries: QuestLogEntry[], title: string): QuestLogEntry | null {
    const needle = title.toLowerCase();
    return (
      entries.find((entry) => entry.title.toLowerCase() === needle) ??
      entries.find((entry) => entry.title.toLowerCase().includes(needle)) ??
      null
    );
  }

  static parse(html: string): QuestLogEntry[] {
    // Everything before the first section heading is the page's own chrome.
    const sections = [...html.matchAll(SECTION)].map((match) => ({
      name: match[1].trim(),
      at: match.index,
    }));

    const sectionAt = (index: number): string => {
      let name = "";
      for (const section of sections) {
        if (section.at > index) break;
        name = section.name;
      }
      return name;
    };

    const entries = [...html.matchAll(ENTRY)];
    return entries.flatMap((match, i) => {
      const section = sectionAt(match.index);
      // Before the first section heading there is no quest, only the tab bar.
      if (!section) return [];

      const from = match.index + match[0].length;
      // Bounded by the next quest, and by the end of the section either way:
      // the last entry would otherwise run on through the page's footer.
      const closing = html.indexOf("</blockquote>", from);
      const to = Math.min(
        entries[i + 1]?.index ?? html.length,
        closing === -1 ? html.length : closing,
      );
      return [
        {
          section,
          title: questLogText(match[1]),
          text: questLogText(html.slice(from, to)),
        },
      ];
    });
  }
}
