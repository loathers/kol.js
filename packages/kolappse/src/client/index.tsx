import { createElement } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import "./palette.css";

declare global {
  interface Window {
    __klp_loaded__?: boolean;
    __klp_open?(): void;
    __KOLAPPSE_VERSION__?: string;
    __KOLAPPSE_COMMIT__?: string;
  }
}

if (!window.__klp_loaded__) {
  window.__klp_loaded__ = true;

  // Every frame forwards Cmd/Ctrl+K to the top frame's toggle
  document.addEventListener(
    "keydown",
    (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        window.top?.__klp_open?.();
      }
    },
    { capture: true },
  );

  // Only the top frame mounts the React app
  if (window === window.top) {
    function mount() {
      const container = document.createElement("div");
      container.className = "klp-root";
      document.body.appendChild(container);
      createRoot(container).render(createElement(App));
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", mount);
    } else {
      mount();
    }
  }
}
