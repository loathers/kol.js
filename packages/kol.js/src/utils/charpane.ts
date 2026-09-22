/** charpane.php is the only page carrying these once api.php goes empty. */

export function parseInValhalla(charpane: string): boolean {
  return (
    charpane.includes("otherimages/spirit.gif") ||
    charpane.includes("<br>Lvl. <img")
  );
}

export function parsePasswordHash(charpane: string): string | null {
  return /var\s+pwdhash\s*=\s*["']([0-9a-f]+)["']/i.exec(charpane)?.[1] ?? null;
}

export function parsePlayerId(charpane: string): string | null {
  return /var\s+playerid\s*=\s*(\d+)/i.exec(charpane)?.[1] ?? null;
}
