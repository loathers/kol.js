import { type ComponentType, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { GameLayout } from "./GameLayout";
import "./blocks/loginBlock.js";
import { type Block, getMatchingBlocks } from "./blocks/registry";
import { registerAboutCommand } from "./commands/about";
import { registerFlagsCommand } from "./commands/flags";
import { registerInventoryCommand } from "./commands/inventory";
import { registerSwitchAccountCommand } from "./commands/switchAccount";
import { CommandPalette } from "./components/CommandPalette";
import { Dock } from "./components/Dock";
import { Panel, type PanelRect } from "./components/Panel";

type PanelState = {
  id: string;
  title: string;
  icon?: string;
  View: ComponentType<{ onClose(): void }>;
  zIndex: number;
  minimized: boolean;
  savedRect?: PanelRect;
};

function BlockPortal({ block }: { block: Block }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  if (!containerRef.current) {
    const target = (() => {
      if (typeof block.selector === "string") {
        return document.querySelector(block.selector);
      }
      return block.selector(document);
    })();
    if (target?.parentElement) {
      containerRef.current = document.createElement("div");
      containerRef.current.className = "klp-block";
      target.parentElement.insertBefore(containerRef.current, target);
    }
  }

  if (!containerRef.current) return null;
  return createPortal(block.component, containerRef.current);
}

let commandsRegistered = false;

export default function App() {
  const [panels, setPanels] = useState<PanelState[]>([]);

  if (!commandsRegistered) {
    commandsRegistered = true;
    registerAboutCommand();
    registerFlagsCommand();
    registerInventoryCommand();
    registerSwitchAccountCommand();
  }

  function openPanel(
    title: string,
    View: ComponentType<{ onClose(): void }>,
    icon?: string,
  ) {
    const id = `panel-${Date.now()}`;
    setPanels((prev) => {
      const maxZ = prev.reduce((m, p) => Math.max(m, p.zIndex), 999);
      return [
        ...prev,
        { id, title, icon, View, zIndex: maxZ + 1, minimized: false },
      ];
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
      prev.map((p) =>
        p.id === id ? { ...p, minimized: true, savedRect: rect } : p,
      ),
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

  const isGamePage = window.location.pathname === "/game.php";
  const pageBlocks = getMatchingBlocks(window.location.pathname);

  const visible = panels.filter((p) => !p.minimized);
  const docked = panels.filter((p) => p.minimized);

  return (
    <>
      {isGamePage && <GameLayout />}
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
      <Dock items={docked} onRestore={restorePanel} onClose={closePanel} />
      {pageBlocks.map((b, i) => (
        <BlockPortal key={i} block={b} />
      ))}
    </>
  );
}
