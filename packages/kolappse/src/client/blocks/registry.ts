import type { ReactNode } from "react";

export type Block = {
  path: string | RegExp;
  selector: string;
  component: ReactNode;
};

const blocks: Block[] = [];

export function registerBlock(block: Block): void {
  blocks.push(block);
}

export function getMatchingBlocks(pathname: string): Block[] {
  return blocks.filter((b) =>
    typeof b.path === "string"
      ? b.path === pathname
      : b.path.test(pathname),
  );
}
