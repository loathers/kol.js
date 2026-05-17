import { registerInterceptor } from "kol.js";

export function registerDecorator(version: string, commitHash: string): void {
  // Inject palette globals + script into every HTML page
  registerInterceptor({
    decorate(html) {
      const injection = `<script>
window.__KOLAPPSE_VERSION__=${JSON.stringify(version)};
window.__KOLAPPSE_COMMIT__=${JSON.stringify(commitHash)};
</script>
<script src="/_kolappse/palette.js"></script>`;
      if (html.includes("</head>"))
        return html.replace("</head>", `${injection}</head>`);
      return html + injection;
    },
  });

  // Serve game.php ourselves — the frameset layout hasn't changed in 20 years.
  // This gives us a real <body> to mount the palette overlay into.
  registerInterceptor({
    path: "game.php",
    handle() {
      const html = `<!doctype html>
<html>
<head>
<title>The Kingdom of Loathing</title>
<style>html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; }</style>
<script>
window.__KOLAPPSE_VERSION__=${JSON.stringify(version)};
window.__KOLAPPSE_COMMIT__=${JSON.stringify(commitHash)};
</script>
<script src="/_kolappse/palette.js"></script>
</head>
<body></body>
</html>`;
      return { status: 200, contentType: "text/html", body: html };
    },
  });
}
