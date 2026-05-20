import type { Client } from "../Client.js";

export type KolRequest = {
  path: string;
  method: string;
  params: URLSearchParams;
};

export type KolResponse = {
  status: number;
  contentType: string;
  body: string | Buffer;
};

export interface Interceptor {
  path?: string | RegExp;
  matches?: (req: KolRequest) => boolean;
  onRequest?(client: Client, req: KolRequest): void | Promise<void>;
  onResponse?(
    client: Client,
    req: KolRequest,
    res: KolResponse,
  ): void | Promise<void>;
  decorate?(
    client: Client,
    req: KolRequest,
    res: KolResponse,
  ): string | Promise<string>;
  handle?(
    client: Client,
    req: KolRequest,
  ): KolResponse | null | Promise<KolResponse | null>;
}
