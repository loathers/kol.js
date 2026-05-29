import { AsyncLocalStorage } from "node:async_hooks";

import type { Client, RequestOptions } from "../Client.js";
import { registerInterceptor } from "./registry.js";
import type { KolRequest, KolResponse } from "./types.js";

export type ActionSuccess<T extends object> = { success: true } & T;
export type ActionFailure = { success: false; reason: string };
export type ActionResult<T extends object> = ActionSuccess<T> | ActionFailure;

export const success = <T extends object>(data: T): ActionSuccess<T> => ({
  success: true,
  ...data,
});

export const failure = (reason: string): ActionFailure => ({
  success: false,
  reason,
});

// --- Callback context types ---

export type ParseCtx = {
  req: KolRequest;
  body: string;
  client: Client;
  success: typeof success;
  failure: typeof failure;
};

export type OnSuccessCtx<T extends object> = {
  client: Client;
  result: ActionSuccess<T>;
  req: KolRequest;
};

export type OnFailureCtx = {
  client: Client;
  result: ActionFailure;
  req: KolRequest;
};

export type DecorateCtx<T extends object> = {
  client: Client;
  req: KolRequest;
  res: KolResponse;
  result: ActionResult<T> | null;
};

// --- ActionDef shapes ---

// Shared parse/success/failure/decorate fields, requiring parse
type ParseDef<T extends object> = {
  matches?: (req: KolRequest) => boolean;
  parse: (ctx: ParseCtx) => ActionResult<T> | Promise<ActionResult<T>>;
  onSuccess?: (ctx: OnSuccessCtx<T>) => void | Promise<void>;
  onFailure?: (ctx: OnFailureCtx) => void | Promise<void>;
  decorate?: (ctx: DecorateCtx<T>) => string | Promise<string>;
};

// Has a concrete path → perform() is available
type WithPath<T extends object> = ParseDef<T> & { path: string };

// Matches-only (no path) → no perform(), interceptor only
type WithMatcher<T extends object> = ParseDef<T> & {
  path?: never;
  matches: (req: KolRequest) => boolean;
};

// Decorate-only → no parse, onSuccess, or onFailure
type DecorateOnly = {
  path?: string;
  matches?: (req: KolRequest) => boolean;
  decorate: (ctx: DecorateCtx<never>) => string | Promise<string>;
};

type PerformFn<T extends object> = (
  client: Client,
  options?: RequestOptions,
) => Promise<ActionResult<T>>;

const actionResultStorage = new AsyncLocalStorage<{
  result?: ActionResult<object>;
}>();

export function defineAction<T extends object>(def: WithPath<T>): PerformFn<T>;
export function defineAction<T extends object>(def: WithMatcher<T>): void;
export function defineAction(def: DecorateOnly): void;
// Implementation uses `any` — the overloads above enforce the public contract
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function defineAction<T extends object>(def: any): PerformFn<T> | void {
  const decorateResults = new WeakMap<KolRequest, ActionResult<T>>();
  const parseFn: ParseDef<T>["parse"] | undefined = def.parse;
  const decorateFn: ParseDef<T>["decorate"] | DecorateOnly["decorate"] | undefined =
    def.decorate;

  registerInterceptor({
    path: def.path,
    matches: def.matches,
    onResponse: parseFn
      ? async (client, req, res) => {
          if (typeof res.body !== "string") return;
          let result: ActionResult<T>;
          try {
            result = await parseFn({ req, body: res.body, client, success, failure });
          } catch (e) {
            result = failure(e instanceof Error ? e.message : "Parse error");
          }
          if (decorateFn) decorateResults.set(req, result);
          const ctx = actionResultStorage.getStore() as
            | { result?: ActionResult<T> }
            | undefined;
          if (ctx) ctx.result = result;
          if (result.success) await def.onSuccess?.({ client, result, req });
          else await def.onFailure?.({ client, result, req });
        }
      : undefined,
    decorate: decorateFn
      ? async (client, req, res) => {
          const result = decorateResults.get(req) ?? null;
          decorateResults.delete(req);
          return decorateFn({ client, req, res, result: result as never });
        }
      : undefined,
  });

  if (parseFn && typeof def.path === "string") {
    const path: string = def.path;
    return async (client: Client, options: RequestOptions = {}) => {
      const ctx: { result?: ActionResult<T> } = {};
      await actionResultStorage.run(ctx, () => client.fetchText(path, options));
      return ctx.result ?? failure("Action produced no result");
    };
  }
}
