import type { ComponentType } from "react";

export type CommandView = ComponentType<{ onClose(): void }>;

export type Command = {
  id: string;
  label: string;
  icon?: string;
  keywords?: string[];
} & ({ action(): void | Promise<void>; view?: never } | { view: CommandView; action?: never });

const commands: Command[] = [];

export function registerCommand(cmd: Command): void {
  commands.push(cmd);
}

export function getCommands(): Command[] {
  return commands;
}
