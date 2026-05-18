// Dev-only entry used when the Vite dev server is running.
// Installs React Fast Refresh before the main entry loads — this is what
// Vite's HTML transform normally injects, but we load the entry directly
// from an external origin so we must do it explicitly here.

declare global {
  interface Window {
    $RefreshReg$: () => void;
    $RefreshSig$: () => (type: unknown) => unknown;
    __vite_plugin_react_preamble_installed__: boolean;
  }
}

// @ts-ignore — /@react-refresh is a Vite virtual module, not a real package
import RefreshRuntime from "/@react-refresh";
RefreshRuntime.injectIntoGlobalHook(window);
window.$RefreshReg$ = () => {};
window.$RefreshSig$ = () => (type) => type;
window.__vite_plugin_react_preamble_installed__ = true;

// Dynamic import so the preamble globals above are set before any component
// module is evaluated (static imports are hoisted and would run first).
import("./index");
