import type { Client } from "../Client.js";
import type { Interceptor, KolRequest, KolResponse } from "./types.js";

function matches(interceptor: Interceptor, req: KolRequest): boolean {
  if (interceptor.matches) return interceptor.matches(req);
  if (!interceptor.path) return true;
  if (typeof interceptor.path === "string")
    return req.path === interceptor.path;
  return interceptor.path.test(req.path);
}

/**
 * The interceptors attached to one client.
 *
 * Interception is a per-client subscription, never a process-wide one: a host
 * driving several accounts has to be able to observe, constrain or fake one
 * client's traffic without touching another's, and a test must not leak into
 * the next.
 *
 * The descriptors themselves stay shareable. Every hook is handed its client,
 * and anything per-request keys off the `KolRequest`, so one descriptor can sit
 * in many lists at once — which is how the domains register a single module-level
 * action against every client that constructs them.
 */
export class InterceptorList {
  #client: Client;
  #entries: Interceptor[] = [];

  constructor(client: Client) {
    this.#client = client;
  }

  add(...interceptors: Interceptor[]): void {
    this.#entries.push(...interceptors);
  }

  /**
   * Add ahead of everything registered so far. Registration order decides which
   * `handle` hook serves a page, and the domains register while the client is
   * still being constructed, so this is how a caller pre-empts the library.
   */
  addFirst(...interceptors: Interceptor[]): void {
    this.#entries.unshift(...interceptors);
  }

  remove(interceptor: Interceptor): boolean {
    const i = this.#entries.indexOf(interceptor);
    if (i < 0) return false;
    this.#entries.splice(i, 1);
    return true;
  }

  matching(req: KolRequest): Interceptor[] {
    return this.#entries.filter((i) => matches(i, req));
  }

  /** A hook that throws vetoes the request, before any I/O happens. */
  async request(req: KolRequest): Promise<void> {
    for (const i of this.matching(req)) {
      await i.onRequest?.(this.#client, req);
    }
  }

  async response(req: KolRequest, res: KolResponse): Promise<void> {
    for (const i of this.matching(req)) {
      await i.onResponse?.(this.#client, req, res);
    }
  }

  /** The first interceptor to return a response serves it; null means "not mine". */
  async handle(req: KolRequest): Promise<KolResponse | null> {
    for (const i of this.matching(req)) {
      const res = await i.handle?.(this.#client, req);
      if (res != null) return res;
    }
    return null;
  }

  async decorate(req: KolRequest, res: KolResponse): Promise<string> {
    let html = typeof res.body === "string" ? res.body : "";
    for (const i of this.matching(req)) {
      if (i.decorate)
        html = await i.decorate(this.#client, req, { ...res, body: html });
    }
    return html;
  }
}
