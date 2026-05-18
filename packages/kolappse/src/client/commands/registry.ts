import type { ComponentType } from "react";

export type CommandView = ComponentType<{ onClose(): void }>;

export type Command = {
  id: string;
  label: string;
  icon?: string;
  keywords?: string[];
  /** Present when the command works without an active session. Omit for commands that need a logged-in client. */
  unauthenticated?: true;
} & ({ action(): void | Promise<void>; view?: never } | { view: CommandView; action?: never });

const commands: Command[] = [];

export function registerCommand(cmd: Command): void {
  commands.push(cmd);
}

export function getCommands(authed: boolean): Command[] {
  return authed ? commands : commands.filter((c) => c.unauthenticated);
}
