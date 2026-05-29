import type { Client } from "../Client.js";
import { getMatchingInterceptors } from "./registry.js";
import type { KolRequest, KolResponse } from "./types.js";

export async function runRequestPipeline(
  client: Client,
  req: KolRequest,
): Promise<void> {
  for (const i of getMatchingInterceptors(req)) {
    await i.onRequest?.(client, req);
  }
}

export async function runResponsePipeline(
  client: Client,
  req: KolRequest,
  res: KolResponse,
): Promise<void> {
  for (const i of getMatchingInterceptors(req)) {
    await i.onResponse?.(client, req, res);
  }
}

export async function runHandlePipeline(
  client: Client,
  req: KolRequest,
): Promise<KolResponse | null> {
  for (const i of getMatchingInterceptors(req)) {
    if (i.handle) {
      const result = await i.handle(client, req);
      if (result !== null) return result;
    }
  }
  return null;
}

export async function runDecoratePipeline(
  client: Client,
  req: KolRequest,
  res: KolResponse,
): Promise<string> {
  let html = typeof res.body === "string" ? res.body : "";
  for (const i of getMatchingInterceptors(req)) {
    if (i.decorate) html = await i.decorate(client, req, { ...res, body: html });
  }
  return html;
}
