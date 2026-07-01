import type { Client } from "../Client.js";

export type PvpSeason = {
  seasonNumber: number;
  seasonName: string;
  endsAt: Date;
};

export class Pvp {
  #client: Client;

  constructor(client: Client) {
    this.#client = client;
  }

  async getCurrentSeason(): Promise<PvpSeason> {
    const [rulesHtml, shopHtml] = await Promise.all([
      this.#client.fetchText("peevpee.php", { query: { place: "rules" } }),
      this.#client.fetchText("peevpee.php", { query: { place: "shop" } }),
    ]);
    return Pvp.parseSeason(rulesHtml, shopHtml);
  }

  static parseSeason(rulesHtml: string, shopHtml: string): PvpSeason {
    const numberMatch = rulesHtml.match(/<b>Current Season:\s*<\/b>\s*(\d+)/i);
    if (!numberMatch)
      throw new Error("Could not parse PvP season number from peevpee.php");

    const endMatch = rulesHtml.match(
      /current season will end on <b>(\d{4}-\d{2}-\d{2})<\/b>/i,
    );

    const nameMatch = shopHtml.match(
      /You've earned [\d,]+ swagger during an? ([\w ]+) season\./i,
    );
    if (!nameMatch)
      throw new Error("Could not parse PvP season name from peevpee.php");

    const adjective = nameMatch[1];
    const seasonName =
      adjective.charAt(0).toUpperCase() + adjective.slice(1) + " Season";

    return {
      seasonNumber: Number(numberMatch[1]),
      seasonName,
      endsAt: endMatch ? new Date(endMatch[1]) : new Date(NaN),
    };
  }
}
