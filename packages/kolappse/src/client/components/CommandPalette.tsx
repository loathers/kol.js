import { Command } from "cmdk";
import { type ComponentType, createContext, useContext, useEffect, useState } from "react";

import { getCommands } from "../commands/registry";
import styles from "./CommandPalette.module.css";

export type Layer = {
  title: string;
  icon?: string;
  View: ComponentType<{ onClose(): void }>;
};

export const LayerContext = createContext<{
  pushLayer: (layer: Layer) => void;
} | null>(null);

export function useLayerContext() {
  const ctx = useContext(LayerContext);
  if (!ctx) throw new Error("useLayerContext must be used inside CommandPalette");
  return ctx;
}

type CommandPaletteProps = {
  onPopOut(
    title: string,
    View: ComponentType<{ onClose(): void }>,
    icon?: string,
  ): void;
};

export function CommandPalette({ onPopOut }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [layers, setLayers] = useState<Layer[]>([]);

  useEffect(() => {
    window.__klp_open = () => setOpen((v) => !v);
    return () => {
      window.__klp_open = undefined;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (layers.length > 0) {
        setLayers((l) => l.slice(0, -1));
      } else {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, layers.length]);

  function close() {
    setLayers([]);
    setOpen(false);
  }

  function pushLayer(layer: Layer) {
    setLayers((l) => [...l, layer]);
  }

  function popLayer() {
    setLayers((l) => l.slice(0, -1));
  }

  function popOut() {
    const top = layers[layers.length - 1];
    if (!top) return;
    onPopOut(top.title, top.View, top.icon);
    close();
  }

  if (!open) return null;

  const activeLayer = layers[layers.length - 1];

  return (
    <LayerContext.Provider value={{ pushLayer }}>
    <div className={styles.overlay} onClick={close}>
      <div className={styles.palette} onClick={(e) => e.stopPropagation()}>
        {activeLayer ? (
          <>
            <div className={styles.breadcrumb}>
              <button className={styles.back} onClick={popLayer}>
                &lt; Back
              </button>
              <span className={styles.breadcrumbTitle}>
                {activeLayer.title}
              </span>
              <button
                className={styles.popOut}
                onClick={popOut}
                title="Pop out"
              >
                Pop out
              </button>
            </div>
            <div className={styles.viewBody}>
              <activeLayer.View onClose={close} />
            </div>
          </>
        ) : (
          <Command>
            <Command.Input placeholder="Type a command..." autoFocus />
            <Command.List>
              <Command.Empty>No results found.</Command.Empty>
              {getCommands(
                !window.location.pathname.startsWith("/login.php"),
              ).map((cmd) => (
                <Command.Item
                  key={cmd.id}
                  value={[cmd.label, ...(cmd.keywords ?? [])].join(" ")}
                  onSelect={() => {
                    if (cmd.view) {
                      pushLayer({
                        title: cmd.label,
                        icon: cmd.icon,
                        View: cmd.view,
                      });
                    } else if (cmd.action) {
                      close();
                      void cmd.action();
                    }
                  }}
                >
                  {cmd.label}
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        )}
      </div>
    </div>
    </LayerContext.Provider>
  );
}
