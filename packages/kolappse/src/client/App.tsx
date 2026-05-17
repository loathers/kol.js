import { useState } from "react";
import { registerAboutCommand, AboutDialog } from "./commands/about";
import { registerFlagsCommand, FlagsDialog } from "./commands/flags";
import { registerInventoryCommand, InventoryDialog } from "./commands/inventory";
import { CommandPalette } from "./components/CommandPalette";
import { GameLayout } from "./GameLayout";

type DialogId = "about" | "flags" | "inventory" | null;

let commandsRegistered = false;

export default function App() {
  const [dialog, setDialog] = useState<DialogId>(null);

  if (!commandsRegistered) {
    commandsRegistered = true;
    registerAboutCommand(setDialog as (id: string) => void);
    registerFlagsCommand(setDialog as (id: string) => void);
    registerInventoryCommand(setDialog as (id: string) => void);
  }

  function closeDialog() {
    setDialog(null);
  }

  return (
    <>
      <GameLayout />
      <CommandPalette onAction={closeDialog} />
      {dialog === "about" && <AboutDialog onClose={closeDialog} />}
      {dialog === "flags" && <FlagsDialog onClose={closeDialog} />}
      {dialog === "inventory" && <InventoryDialog onClose={closeDialog} />}
    </>
  );
}
