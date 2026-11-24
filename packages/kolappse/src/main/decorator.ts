import { type DecorateCtx, type Interceptor, defineAction } from "kol.js";

function clientScript(): string {
  const modules = [];
  if (import.meta.env.DEV) {
    const DEV_SERVER_URL = "http://localhost:5174";
    modules.push(
      `${DEV_SERVER_URL}/@vite/client`,
      `${DEV_SERVER_URL}/hmr-entry.ts`,
    );
  } else {
    modules.push("/_kolappse/kolappse.js");
  }
  return modules
    .map((module) => `<script type="module" src="${module}"></script>`)
    .join("\n");
}

export function decoratorInterceptors(
  version: string,
  commitHash: string,
): Interceptor[] {
  const injection = `<script>
window.__KOLAPPSE_VERSION__=${JSON.stringify(version)};
window.__KOLAPPSE_COMMIT__=${JSON.stringify(commitHash)};
</script>
${clientScript()}`;

  // Inject kolappse globals + script into every HTML page
  const injectScript = defineAction({
    decorate({ res }: DecorateCtx<never>) {
      const html = typeof res.body === "string" ? res.body : "";
      if (html.includes("</head>"))
        return html.replace("</head>", `${injection}</head>`);
      return html + injection;
    },
  });

  // Serve game.php ourselves — the frameset layout hasn't changed in 20 years.
  // This gives us a real <body> to mount the palette overlay into.
  const serveGamePage: Interceptor = {
    path: "game.php",
    handle() {
      const html = `<!doctype html>
<html>
<head>
<title>The Kingdom of Loathing</title>
<style>html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; }</style>
${injection}
</head>
<body></body>
</html>`;
      return { status: 200, contentType: "text/html", body: html };
    },
  };

  return [serveGamePage, injectScript];
}
