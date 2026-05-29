import type { ReactNode } from "react";

export type Block = {
  path: string | RegExp;
  selector: string | ((doc: Document) => Element | null | undefined);
  component: ReactNode;
};

const blocks: Block[] = [];

export function registerBlock(block: Block): void {
  const key = block.selector.toString();
  const idx = blocks.findIndex((b) => b.selector.toString() === key);
  if (idx >= 0) blocks.splice(idx, 1, block);
  else blocks.push(block);
}

export function getMatchingBlocks(pathname: string): Block[] {
  return blocks.filter((b) =>
    typeof b.path === "string" ? b.path === pathname : b.path.test(pathname),
  );
}
