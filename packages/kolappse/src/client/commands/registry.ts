export type Command = {
  id: string;
  label: string;
  keywords?: string[];
  action(): void | Promise<void>;
};

const commands: Command[] = [];

export function registerCommand(cmd: Command): void {
  commands.push(cmd);
}

export function getCommands(): Command[] {
  return commands;
}
