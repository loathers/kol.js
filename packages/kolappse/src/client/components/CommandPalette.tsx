import { Command } from "cmdk";
import { useEffect, useState } from "react";
import { getCommands } from "../commands/registry";
import styles from "./CommandPalette.module.css";

type CommandPaletteProps = {
  onAction(): void;
};

export function CommandPalette({ onAction }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    window.__klp_open = () => setOpen((v) => !v);
    return () => {
      window.__klp_open = undefined;
    };
  }, []);

  function close() {
    setOpen(false);
  }

  function runCommand(action: () => void | Promise<void>) {
    close();
    onAction();
    void action();
  }

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={close}>
      <div className={styles.palette} onClick={(e) => e.stopPropagation()}>
        <Command>
          <Command.Input placeholder="Type a command…" autoFocus />
          <Command.List>
            <Command.Empty>No results found.</Command.Empty>
            {getCommands().map((cmd) => (
              <Command.Item
                key={cmd.id}
                value={[cmd.label, ...(cmd.keywords ?? [])].join(" ")}
                onSelect={() => runCommand(cmd.action)}
              >
                {cmd.label}
              </Command.Item>
            ))}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
