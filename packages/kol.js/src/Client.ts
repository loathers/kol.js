import { Mutex } from "async-mutex";
import { Item } from "data-of-loathing";
import type { AscensionClass, Path } from "data-of-loathing";
import Emittery from "emittery";
import makeFetchCookie from "fetch-cookie";
import { type FetchOptions, ofetch } from "ofetch";
import { CookieJar } from "tough-cookie";
import type { Dispatcher } from "undici";

import pkg from "../package.json" with { type: "json" };
import { gameData } from "./GameData.js";
import "./domains/Bookshelf.js";
import { ApiStatusSchema, type ApiStatus } from "./domains/ApiStatus.js";
import { CharSheet } from "./domains/CharSheet.js";
import { Effects } from "./domains/Effects.js";
import { Equipment } from "./domains/Equipment.js";
import { ChatMailbox, type ChatMessage } from "./domains/ChatMailbox.js";
import { Closet } from "./domains/Closet.js";
import { Inventory } from "./domains/Inventory.js";
import { KmailMailbox, type KmailMessage } from "./domains/KmailMailbox.js";
import { Players } from "./domains/Players.js";
import { Skills } from "./domains/Skills.js";
import { Storage } from "./domains/Storage.js";
import { AuthError, JoinClanError, RolloverError } from "./errors.js";
import { Flags, type FlagsBackend } from "./flags/Flags.js";
import { ProxyServer } from "./proxy/ProxyServer.js";
import { runRequestPipeline, runResponsePipeline } from "./proxy/pipeline.js";
import { registerInterceptor } from "./proxy/registry.js";
import { deduplicate } from "./utils/deduplicate.js";
import { sanitiseBlueText, wait } from "./utils/utils.js";
import { resolveEntityId } from "./utils/utils.js";

export type MallPrice = {
  formattedMallPrice: string;
  formattedLimitedMallPrice: string;
  formattedMinPrice: string;
  mallPrice: number;
  limitedMallPrice: number;
  minPrice: number | null;
};

export type Result<T = void> =
  | { success: true; data?: T }
  | { success: false; reason: string };

class LoginRedirectError extends Error {}

type FormData = Record<string, string | number | boolean>;

type RequestOptions = {
  method?: string;
  query?: Record<string, unknown>;
  form?: FormData;
  signal?: AbortSignal;
};

function formToBody(form: FormData): URLSearchParams {
  return new URLSearchParams(
    Object.entries(form).map(([k, v]) => [k, String(v)]),
  );
}

function buildProxyRequest(path: string, options: RequestOptions) {
  const params = new URLSearchParams();
  if (options.query) {
    for (const [k, v] of Object.entries(options.query)) {
      if (v !== undefined && v !== null) params.set(k, String(v));
    }
  }
  if (options.form) {
    for (const [k, v] of Object.entries(options.form)) {
      params.set(k, String(v));
    }
  }
  return { path, method: options.method ?? "POST", params };
}

type PlayerPayload = { playerName: string; playerId: string };

type Events = {
  kmail: KmailMessage;
  whisper: ChatMessage;
  system: ChatMessage;
  public: ChatMessage;
  rollover: Date;
  login: PlayerPayload;
  logout: PlayerPayload;
  apiStatus: ApiStatus;
};

type Familiar = {
  id: number;
  name: string;
  image: string;
};


export class Client extends Emittery<Events> {
  // Registered once at class-definition time. Fires for both proxy navigation
  // to logout.php and for explicit client.logout() calls (which manually
  // invoke runResponsePipeline after the session call).
  static {
    registerInterceptor({
      path: "logout.php",
      onResponse(client: Client) {
        const payload = {
          playerName: client.#username,
          playerId: client.#playerId,
        };
        client.#pwd = "";
        void client.emit("logout", payload);
      },
    });
  }

  actionMutex = new Mutex();
  #cookieJar = new CookieJar();
  protected get baseURL() {
    return "https://www.kingdomofloathing.com";
  }

  protected get dispatcher(): Dispatcher | undefined {
    return undefined;
  }

  session = ofetch.create(
    {
      retry: 0,
      headers: { "user-agent": `kol.js/${pkg.version}` },
      onRequest: ({ options }) => {
        options.baseURL = this.baseURL;
        options.dispatcher = this.dispatcher;
        if (options.query) {
          const { pwd: _, ...rest } = options.query;
          options.query = { ...rest, pwd: this.#pwd };
        }
        if (options.body instanceof URLSearchParams) {
          options.body.set("pwd", this.#pwd);
        }
      },
      onResponse: ({ request, response }) => {
        const requestUrl = typeof request === "string" ? request : request.url;
        if (response.url.includes("/maint.php")) {
          this.#isRollover = true;
          throw new RolloverError();
        }
        if (this.#isRollover) {
          this.#isRollover = false;
          void this.emit("rollover", new Date());
        }
        if (
          !requestUrl.includes("login.php") &&
          !requestUrl.includes("logout.php") &&
          response.url.includes("/login.php")
        ) {
          throw new LoginRedirectError();
        }
      },
    },
    { fetch: makeFetchCookie(fetch, this.#cookieJar) },
  );
  charSheet = new CharSheet(this);
  effects = new Effects(this);
  equipment = new Equipment(this);
  skills = new Skills(this);
  closet = new Closet(this);
  inventory = new Inventory(this);
  players = new Players(this);
  storage = new Storage(this);
  chat = new ChatMailbox(this);
  kmail = new KmailMailbox(this);
  flags: Flags;

  #username: string;
  #password: string;
  #isRollover = false;
  #hardcore = false;
  #roninLeft = 0;
  #disposed = false;
  #chatBotStarted = false;
  #pwd = "";
  #playerId = "";
  #level = 0;
  #class: AscensionClass | null = null;
  #path: Path | null = null;
  #adventures = 0;
  #hp = 0;
  #maxHp = 0;
  #mp = 0;
  #maxMp = 0;

  constructor(
    username: string = "",
    password: string = "",
    options: { flagsBackend?: FlagsBackend } = {},
  ) {
    super();
    this.#username = username;
    this.#password = password;
    this.flags = new Flags(username, options.flagsBackend);
  }

  get username() {
    return this.#username;
  }

  get playerId() {
    return this.#playerId;
  }

  get level() {
    return this.#level;
  }

  get class() {
    return this.#class;
  }

  get path() {
    return this.#path;
  }

  get adventures() {
    return this.#adventures;
  }

  get hp() {
    return this.#hp;
  }

  get maxHp() {
    return this.#maxHp;
  }

  get mp() {
    return this.#mp;
  }

  get maxMp() {
    return this.#maxMp;
  }

  async #withRecovery<T>(fn: () => Promise<T>): Promise<T> {
    if (this.#isRollover) await this.waitForRolloverEnd();

    if (!this.#pwd && !(await this.login())) {
      if (this.#isRollover) {
        await this.waitForRolloverEnd();
        if (!(await this.login())) throw new AuthError();
      } else {
        throw new AuthError();
      }
    }

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (error instanceof RolloverError) {
          await this.waitForRolloverEnd();
          if (!(await this.login())) throw new AuthError();
          continue;
        }
        if (error instanceof LoginRedirectError && attempt === 0) {
          this.#pwd = "";
          if (!(await this.login())) {
            if (this.#isRollover) {
              await this.waitForRolloverEnd();
              if (!(await this.login())) throw new AuthError();
            } else {
              throw new AuthError();
            }
          }
          continue;
        }
        throw error;
      }
    }

    throw new AuthError();
  }

  async fetchText(path: string, options: RequestOptions = {}): Promise<string> {
    const req = buildProxyRequest(path, options);
    await runRequestPipeline(this, req);
    const { form, ...rest } = options;
    const text = await this.#withRecovery(() =>
      this.session(path, {
        method: "POST",
        ...rest,
        body: form ? formToBody(form) : undefined,
        responseType: "text",
      }),
    );
    const res = { status: 200, contentType: "text/html", body: text };
    await runResponsePipeline(this, req, res);
    return res.body as string;
  }

  async fetchJson<Result>(
    path: string,
    options: RequestOptions = {},
  ): Promise<Result> {
    const req = buildProxyRequest(path, options);
    await runRequestPipeline(this, req);
    const { form, ...rest } = options;
    const json = await this.#withRecovery(() =>
      this.session<Result>(path, {
        ...rest,
        body: form ? formToBody(form) : undefined,
        responseType: "json",
      }),
    );
    const body = JSON.stringify(json);
    const res = { status: 200, contentType: "application/json", body };
    await runResponsePipeline(this, req, res);
    return json;
  }

  // Proxy session: same cookie jar and user-agent as session, no pwd injection, no login-redirect throw.
  #proxySession = ofetch.create(
    {
      retry: 0,
      headers: { "user-agent": `kol.js/${pkg.version}` },
      onRequest: ({ options }) => {
        options.dispatcher = this.dispatcher;
      },
    },
    { fetch: makeFetchCookie(fetch, this.#cookieJar) },
  );

  async proxyFetch(
    url: string,
    init: RequestInit,
  ): Promise<{ status: number; headers: Headers; url: string; body: Buffer }> {
    const options: FetchOptions<"arrayBuffer"> = {
      method: init.method,
      headers: init.headers,
      body: init.body,
      redirect: init.redirect,
      responseType: "arrayBuffer",
    };
    const res = await this.#proxySession.raw<any, "arrayBuffer">(url, options);
    return {
      status: res.status,
      headers: res.headers,
      url: res.url,
      body: Buffer.from(res._data ?? new ArrayBuffer(0)),
    };
  }

  createProxyServer(): ProxyServer {
    return new ProxyServer(this);
  }

  logout = deduplicate(async (): Promise<void> => {
    await this.fetchText("logout.php");
  });

  login = deduplicate(async (): Promise<boolean> => {
    if (await this.checkLoggedIn()) return true;
    if (this.#isRollover) return false;
    try {
      await this.session("login.php", {
        method: "POST",
        responseType: "text",
        body: formToBody({
          loggingin: "Yup.",
          loginname: this.#username,
          password: this.#password,
          secure: "0",
          submitbutton: "Log In",
        }),
      });

      return await this.checkLoggedIn();
    } catch (error) {
      if (error instanceof RolloverError) return false;
      console.error("Login failed:", error);
      return false;
    }
  });

  isRollover() {
    return this.#isRollover;
  }

  isHardcore() {
    return this.#hardcore;
  }

  roninLeft() {
    return this.#roninLeft;
  }

  inRonin() {
    return this.#roninLeft > 0;
  }

  isRestricted() {
    return this.#hardcore || this.inRonin();
  }

  async checkLoggedIn(): Promise<boolean> {
    try {
      const raw = await this.session<unknown>("api.php", {
        query: { what: "status", for: `${this.#username} bot` },
      });
      if (!raw || typeof raw !== "object" || !("pwd" in raw)) return false;
      const api = ApiStatusSchema.parse(raw);
      void this.emit("apiStatus", api);
      const wasLoggedIn = !!this.#pwd;
      this.#pwd = api.pwd;
      this.#playerId = api.playerid;
      this.#hardcore = api.hardcore;
      this.#roninLeft = api.roninleft;
      this.#level = api.level;
      this.#adventures = api.adventures;
      this.#hp = api.hp;
      this.#maxHp = api.maxhp;
      this.#mp = api.mp;
      this.#maxMp = api.maxmp;
      this.#class = api.class > 0 ? await gameData.findClassById(api.class) : null;
      this.#path = api.path > 0 ? await gameData.findPathById(api.path) : null;
      const prevDay = this.flags.daynumber;
      this.flags.sync(api.daynumber, api.ascensions);
      if (api.daynumber > prevDay && prevDay > 0) {
        this.#invalidateDailyCaches();
      }
      if (!wasLoggedIn) {
        void this.emit("login", {
          playerName: this.#username,
          playerId: this.#playerId,
        });
      }
      return true;
    } catch {
      return false;
    }
  }

  #invalidateDailyCaches(): void {
    this.charSheet.getSkills.invalidate();
    this.inventory.get.invalidate();
    this.closet.get.invalidate();
    this.storage.get.invalidate();
  }

  waitForRolloverEnd = deduplicate(async (): Promise<void> => {
    while (this.#isRollover && !this.#disposed) {
      await wait(this.rolloverCheckInterval);
      try {
        await this.session("login.php", { responseType: "text" });
      } catch {
        // maint.php redirect or server unreachable
      }
    }
  });

  protected get pollInterval() {
    return 3000;
  }

  protected get rolloverCheckInterval() {
    return 60_000;
  }

  #abortController: AbortController | null = null;
  #disposeChatBotListeners: (() => void) | null = null;

  async startChatBot() {
    if (this.#chatBotStarted) return;
    this.#chatBotStarted = true;
    this.#abortController = new AbortController();
    this.#disposeChatBotListeners = this.on(
      "rollover",
      () => void this.#joinChat(),
    );
    await this.#joinChat();
    this.#loopChatBot().catch((error) => {
      console.error("Chat bot stopped:", error);
    });
  }

  stopChatBot() {
    this.#disposeChatBotListeners?.();
    this.#disposeChatBotListeners = null;
    this.#abortController?.abort();
    this.#abortController = null;
    this.#chatBotStarted = false;
  }

  dispose() {
    this.#disposed = true;
    this.stopChatBot();
  }

  async #joinChat() {
    try {
      await this.chat.macro("/join talkie");
    } catch (error) {
      console.error("Failed to join chat:", error);
    }
  }

  async #loopChatBot() {
    while (this.#abortController && !this.#abortController.signal.aborted) {
      try {
        await Promise.all([this.chat.check(), this.kmail.check()]);
      } catch (error) {
        if (error instanceof AuthError) throw error;
        console.error("Chat bot loop error:", error);
      }
      await wait(this.pollInterval);
    }
  }

  async loadGameData(): Promise<void> {
    await gameData.load();
  }

  async fetchStatus(): Promise<ApiStatus> {
    const raw = await this.fetchJson<unknown>("api.php", {
      query: { what: "status", for: `${this.#username} bot` },
    });
    const status = ApiStatusSchema.parse(raw);
    void this.emit("apiStatus", status);
    return status;
  }

  async getMallPrice(item: Item | number): Promise<MallPrice> {
    const itemId = resolveEntityId(item);
    const prices = await this.fetchText("backoffice.php", {
      query: {
        action: "prices",
        ajax: 1,
        iid: itemId,
      },
    });
    const unlimitedMatch = prices.match(
      /<td>unlimited:<\/td><td><b>(?<unlimitedPrice>[\d,]+)/,
    );
    const limitedMatch = prices.match(
      /<td>limited:<\/td><td><b>(?<limitedPrice>[\d,]+)/,
    );
    const unlimitedPrice = unlimitedMatch
      ? parseInt(unlimitedMatch[1].replace(/,/g, ""))
      : 0;
    const limitedPrice = limitedMatch
      ? parseInt(limitedMatch[1].replace(/,/g, ""))
      : 0;
    let minPrice = limitedMatch ? limitedPrice : null;
    minPrice = unlimitedMatch
      ? !minPrice || unlimitedPrice < minPrice
        ? unlimitedPrice
        : minPrice
      : minPrice;
    const formattedMinPrice = minPrice
      ? ((minPrice === unlimitedPrice
          ? unlimitedMatch?.[1]
          : limitedMatch?.[1]) ?? "")
      : "";
    return {
      mallPrice: unlimitedPrice,
      limitedMallPrice: limitedPrice,
      formattedMinPrice: formattedMinPrice,
      minPrice: minPrice,
      formattedMallPrice: unlimitedMatch ? unlimitedMatch[1] : "",
      formattedLimitedMallPrice: limitedMatch ? limitedMatch[1] : "",
    };
  }

  async getItemDescription(descId: number): Promise<{
    melting: boolean;
    singleEquip: boolean;
    blueText: string;
    effect?: {
      name: string;
      duration: number;
      descid: string;
    };
  }> {
    const description = await this.fetchText("desc_item.php", {
      query: { whichitem: descId },
    });
    const blueText = description.match(
      /<center>\s*<b>\s*<font color="?[\w]+"?>(?<description>[\s\S]+)<\/center>/i,
    );
    const effect = description.match(
      /Effect: \s?<b>\s?<a[^>]+href="desc_effect\.php\?whicheffect=(?<descid>[^"]+)[^>]+>(?<effect>[\s\S]+)<\/a>[^(]+\((?<duration>[\d]+)/,
    );
    const melting = description.match(
      /This item will disappear at the end of the day\./,
    );
    const singleEquip = description.match(
      / You may not equip more than one of these at a time\./,
    );

    return {
      melting: !!melting,
      singleEquip: !!singleEquip,
      blueText: sanitiseBlueText(blueText?.groups?.description),
      effect: effect?.groups
        ? {
            name: effect.groups?.effect,
            duration: Number(effect.groups?.duration) || 0,
            descid: effect.groups?.descid,
          }
        : undefined,
    };
  }

  async getEffectDescription(descId: string): Promise<{ blueText: string }> {
    const description = await this.fetchText("desc_effect.php", {
      query: { whicheffect: descId },
    });
    const blueText = description.match(
      /<center><font color="?[\w]+"?>(?<description>[\s\S]+)<\/div>/m,
    );
    return { blueText: sanitiseBlueText(blueText?.groups?.description) };
  }

  async getSkillDescription(id: number): Promise<{ blueText: string }> {
    const description = await this.fetchText("desc_skill.php", {
      query: { whichskill: String(id) },
    });

    const blueText = description.match(
      /<blockquote[\s\S]+<[Cc]enter>(?<description>[\s\S]+)<\/[Cc]enter>/,
    );
    return { blueText: sanitiseBlueText(blueText?.groups?.description) };
  }

  async leaveClan(): Promise<void> {
    await this.fetchText("clan_members.php", {
      method: "POST",
      form: { action: "leaveclan", confirm: "on" },
    });
  }

  async joinClan(id: number): Promise<Result> {
    const result = await this.fetchText("showclan.php", {
      query: {
        whichclan: id,
        action: "joinclan",
        confirm: "on",
      },
    });
    if (
      result.includes("clanhalltop.gif") ||
      result.includes("a clan you're already in")
    )
      return { success: true };
    if (result.includes("leader of an existing clan"))
      return { success: false, reason: "Already leader of a clan" };
    if (result.includes("submitted a request to join"))
      return { success: false, reason: "Not on the whitelist" };
    return { success: false, reason: "Unknown" };
  }

  async getClanWhitelists(): Promise<{ id: number; name: string }[]> {
    const html = await this.fetchText("clan_signup.php");
    const select =
      html.match(/<select name=whichclan>(.*?)<\/select>/s)?.[1] ?? "";
    return [...select.matchAll(/<option value=(\d+)>([^<]+)/g)].map((m) => ({
      id: Number(m[1]),
      name: m[2],
    }));
  }

  async ensureClan(clanId: number): Promise<void> {
    const join = await this.joinClan(clanId);
    if (join.success) return;
    throw new JoinClanError(join.reason);
  }

  async useFamiliar(familiarId: number): Promise<boolean> {
    const result = await this.fetchText("familiar.php", {
      query: {
        action: "newfam",
        newfam: familiarId.toFixed(0),
      },
    });

    return result.includes(`var currentfam = ${familiarId};`);
  }

  async getFamiliars(): Promise<Familiar[]> {
    const terrarium = await this.fetchText("familiar.php");
    const matches = terrarium.matchAll(
      /onClick='fam\((\d+)\)'(?:><img)? src=".*?\/(\w+\/\w+.(?:gif|png))".*?\d+-pound (.*?) \(/g,
    );
    const familiars = [...matches].map((m) => ({
      id: Number(m[1]),
      image: m[2],
      name: m[3],
    }));

    if (terrarium.includes("fam(278)")) {
      familiars.push({
        id: 278,
        image: "otherimages/righthandbody.png",
        name: "Left-Hand Man",
      });
    }

    return familiars;
  }

  static #descIdToIdCache: Map<number, number> = new Map();

  async descIdToId(descId: number): Promise<number> {
    if (Client.#descIdToIdCache.has(descId))
      return Client.#descIdToIdCache.get(descId)!;
    const page = await this.fetchText("desc_item.php", {
      query: { whichitem: descId },
    });
    const id = Number(page.match(/<!-- itemid: (\d+) -->/)?.[1] ?? -1);
    Client.#descIdToIdCache.set(descId, id);
    return id;
  }

  async getStandard(date?: Date) {
    if (!date) {
      date = new Date();
      date.setFullYear(date.getFullYear() - 2);
      date.setMonth(0);
      date.setDate(2);
    }

    const formattedDate = date.toISOString().split("T")[0];

    return await this.fetchText("standard.php", {
      query: { date: formattedDate },
    });
  }
}
