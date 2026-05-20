import createDebug from "debug";
import * as http from "node:http";

import { Client } from "../Client.js";
import {
  runDecoratePipeline,
  runHandlePipeline,
  runRequestPipeline,
  runResponsePipeline,
} from "../interceptors/pipeline.js";
import type { KolRequest, KolResponse } from "../interceptors/types.js";

const debug = createDebug("kol.js:proxy");

const KOL_ORIGIN = "https://www.kingdomofloathing.com";
const STATIC_HOSTS = new Set(["images.kingdomofloathing.com"]);

function buildKolRequest(
  incoming: http.IncomingMessage,
  body: Buffer,
): KolRequest {
  const url = new URL(incoming.url ?? "/", "http://localhost");
  const params = new URLSearchParams(url.search);
  if (
    incoming.method === "POST" &&
    incoming.headers["content-type"]?.includes(
      "application/x-www-form-urlencoded",
    )
  ) {
    for (const [k, v] of new URLSearchParams(body.toString())) {
      params.set(k, v);
    }
  }
  return {
    path: url.pathname.replace(/^\//, ""),
    method: incoming.method ?? "GET",
    params,
  };
}

function rewriteHtml(html: string, port: number): string {
  return html
    .replace(
      /https?:\/\/www\.kingdomofloathing\.com/g,
      `http://localhost:${port}`,
    )
    .replace(/\/\/www\.kingdomofloathing\.com/g, `//localhost:${port}`)
    .replace(/\s+crossorigin(?:=(?:"[^"]*"|'[^']*'|\S+))?/gi, "");
}

export class ProxyServer {
  #client: Client;
  #server: http.Server;
  #port = 0;

  constructor(client: Client = new Client()) {
    this.#client = client;
    this.#server = http.createServer((req, res) => {
      void this.#handleRequest(req, res);
    });
  }

  setClient(client: Client): void {
    this.#client = client;
  }

  async #handleRequest(
    incoming: http.IncomingMessage,
    outgoing: http.ServerResponse,
  ): Promise<void> {
    const client = this.#client;
    try {
      const body = await this.#readBody(incoming);
      const url = new URL(incoming.url ?? "/", "http://localhost");
      const host = url.hostname || "www.kingdomofloathing.com";
      const proxyReq = buildKolRequest(incoming, body);

      if (STATIC_HOSTS.has(host)) {
        await this.#pipeStatic(
          `https://${host}${url.pathname}${url.search}`,
          outgoing,
        );
        return;
      }

      if (proxyReq.path === "" || proxyReq.path === "index.php") {
        outgoing.writeHead(302, {
          location: `http://localhost:${this.#port}/game.php`,
        });
        outgoing.end();
        return;
      }

      await runRequestPipeline(client, proxyReq);

      const handled = await runHandlePipeline(client, proxyReq);
      if (handled !== null) {
        outgoing.statusCode = handled.status;
        outgoing.setHeader("content-type", handled.contentType);
        outgoing.end(handled.body);
        return;
      }

      const upstreamUrl = `${KOL_ORIGIN}/${proxyReq.path}${url.search}`;
      // Only forward content-type for POST bodies; let proxySession supply everything else.
      const forwardHeaders: Record<string, string> = {};
      const contentTypeHeader = incoming.headers["content-type"];
      if (contentTypeHeader) forwardHeaders["content-type"] = contentTypeHeader;

      const fetchOptions = {
        method: incoming.method,
        headers: forwardHeaders,
        body:
          incoming.method !== "GET" && incoming.method !== "HEAD"
            ? new Uint8Array(body)
            : undefined,
        redirect: "follow" as const,
      };

      let upstream = await client.proxyFetch(upstreamUrl, fetchOptions);

      if (
        new URL(upstream.url).pathname === "/login.php" &&
        proxyReq.path !== "logout.php"
      ) {
        debug("session expired, re-logging in");
        await client.login();
        upstream = await client.proxyFetch(upstreamUrl, fetchOptions);
      }

      const contentType =
        upstream.headers.get("content-type") ?? "application/octet-stream";
      const isHtml = contentType.includes("text/html");

      const proxyRes: KolResponse = {
        status: upstream.status,
        contentType,
        body: isHtml ? upstream.body.toString("utf8") : upstream.body,
      };

      await runResponsePipeline(client, proxyReq, proxyRes);

      if (isHtml && typeof proxyRes.body === "string") {
        proxyRes.body = await runDecoratePipeline(proxyReq, proxyRes.body);
        proxyRes.body = rewriteHtml(proxyRes.body, this.#port);
      }

      // If KoL followed a redirect to a different page, tell the browser to follow suit —
      // but only for navigation requests. AJAX/fetch requests get the final content directly;
      // re-issuing a redirect there causes a blank follow-up response for action endpoints.
      const isNavigation = incoming.headers["sec-fetch-mode"] === "navigate";
      const finalPath =
        new URL(upstream.url).pathname + new URL(upstream.url).search;
      const browserPath = `/${proxyReq.path}${url.search}`;
      if (isHtml && isNavigation && finalPath !== browserPath && finalPath !== "/") {
        outgoing.writeHead(302, {
          location: `http://localhost:${this.#port}${finalPath}`,
        });
        outgoing.end();
        return;
      }

      outgoing.statusCode = proxyRes.status;
      outgoing.setHeader("content-type", proxyRes.contentType);
      outgoing.end(proxyRes.body);
    } catch (err) {
      console.error("[ProxyServer] error handling request:", err);
      if (!outgoing.headersSent) {
        outgoing.writeHead(502);
        outgoing.end("Bad Gateway");
      }
    }
  }

  async #pipeStatic(url: string, outgoing: http.ServerResponse): Promise<void> {
    const resp = await fetch(url);
    outgoing.writeHead(resp.status, {
      "content-type":
        resp.headers.get("content-type") ?? "application/octet-stream",
    });
    outgoing.end(Buffer.from(await resp.arrayBuffer()));
  }

  #readBody(incoming: http.IncomingMessage): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      incoming.on("data", (chunk: Buffer) => chunks.push(chunk));
      incoming.on("end", () => resolve(Buffer.concat(chunks)));
      incoming.on("error", reject);
    });
  }

  start(port: number): Promise<void> {
    this.#port = port;
    return new Promise((resolve) => {
      this.#server.listen(port, () => {
        debug("listening on http://localhost:%d", port);
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.#server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}
