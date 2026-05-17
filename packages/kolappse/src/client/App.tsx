import { useState, type ComponentType } from "react";
import { registerAboutCommand } from "./commands/about";
import { registerFlagsCommand } from "./commands/flags";
import { registerInventoryCommand } from "./commands/inventory";
import { CommandPalette } from "./components/CommandPalette";
import { Dock } from "./components/Dock";
import { Panel, type PanelRect } from "./components/Panel";
import { GameLayout } from "./GameLayout";

type PanelState = {
  id: string;
  title: string;
  icon?: string;
  View: ComponentType<{ onClose(): void }>;
  zIndex: number;
  minimized: boolean;
  savedRect?: PanelRect;
};

let commandsRegistered = false;

export default function App() {
  const [panels, setPanels] = useState<PanelState[]>([]);

  if (!commandsRegistered) {
    commandsRegistered = true;
    registerAboutCommand();
    registerFlagsCommand();
    registerInventoryCommand();
  }

  function openPanel(title: string, View: ComponentType<{ onClose(): void }>, icon?: string) {
    const id = `panel-${Date.now()}`;
    setPanels((prev) => {
      const maxZ = prev.reduce((m, p) => Math.max(m, p.zIndex), 999);
      return [...prev, { id, title, icon, View, zIndex: maxZ + 1, minimized: false }];
    });
  }

  function closePanel(id: string) {
    setPanels((prev) => prev.filter((p) => p.id !== id));
  }

  function focusPanel(id: string) {
    setPanels((prev) => {
      const maxZ = prev.reduce((m, p) => Math.max(m, p.zIndex), 999);
      return prev.map((p) => (p.id === id ? { ...p, zIndex: maxZ + 1 } : p));
    });
  }

  function minimizePanel(id: string, rect: PanelRect) {
    setPanels((prev) =>
      prev.map((p) => (p.id === id ? { ...p, minimized: true, savedRect: rect } : p)),
    );
  }

  function restorePanel(id: string) {
    setPanels((prev) => {
      const maxZ = prev.reduce((m, p) => Math.max(m, p.zIndex), 999);
      return prev.map((p) =>
        p.id === id ? { ...p, minimized: false, zIndex: maxZ + 1 } : p,
      );
    });
  }

  const visible = panels.filter((p) => !p.minimized);
  const docked = panels.filter((p) => p.minimized);

  return (
    <>
      <GameLayout />
      <CommandPalette onPopOut={openPanel} />
      {visible.map((p) => (
        <Panel
          key={p.id}
          id={p.id}
          title={p.title}
          icon={p.icon}
          View={p.View}
          zIndex={p.zIndex}
          initialRect={p.savedRect}
          onClose={() => closePanel(p.id)}
          onFocus={() => focusPanel(p.id)}
          onMinimize={(rect) => minimizePanel(p.id, rect)}
        />
      ))}
      <Dock
        items={docked}
        onRestore={restorePanel}
        onClose={closePanel}
      />
    </>
  );
}
