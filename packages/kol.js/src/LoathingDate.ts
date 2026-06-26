import { addDays } from "date-fns";
import { dedent } from "ts-dedent";

import moonSymbols from "./moonSymbols.js";

const GAME_HOLIDAYS = new Map<`${number},${number}`, string>([
  ["0,1", "Festival of Jarlsberg"],
  ["1,4", "Valentine's Day"],
  ["2,3", "St. Sneaky Pete's Day"],
  ["3,2", "Oyster Egg Day"],
  ["4,2", "El Dia De Los Muertos Borrachos"],
  ["5,3", "Generic Summer Holiday"],
  ["6,4", "Dependence Day"],
  ["7,4", "Arrrbor Day"],
  ["8,6", "Labór Day"],
  ["9,8", "Halloween"],
  ["10,7", "Feast of Boris"],
  ["11,4", "Yuletide"],
]);

const MUSCLE_PHASES = new Set([8, 9]);
const MYSTICALITY_PHASES = new Set([4, 12]);
const MOXIE_PHASES = new Set([0, 15]);

function getEaster(year: number): [month: number, date: number] {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const date = ((h + l - 7 * m + 114) % 31) + 1;
  return [month, date];
}

function getThanksgiving(year: number): number {
  // 4th Thursday of November
  const nov1 = new Date(Date.UTC(year, 10, 1)).getUTCDay();
  const firstThursday = ((4 - nov1 + 7) % 7) + 1;
  return firstThursday + 21;
}

function getRealWorldHolidays(realDate: Date): string[] {
  const year = realDate.getUTCFullYear();
  const [easterMonth, easterDate] = getEaster(year);
  const thanksgiving = getThanksgiving(year);

  const key = `${realDate.getUTCMonth()},${realDate.getUTCDate()}`;

  const realHolidays: [string, string][] = [
    ["0,1", "Festival of Jarlsberg"],
    ["1,14", "Valentine's Day"],
    ["2,17", "St. Sneaky Pete's Day"],
    ["3,1", "April Fools Day"],
    [`${easterMonth},${easterDate}`, "Oyster Egg Day"],
    ["6,4", "Dependence Day"],
    ["9,31", "Halloween"],
    [`10,${thanksgiving}`, "Feast of Boris"],
    ["11,25", "Crimbo"],
  ];

  return realHolidays.filter(([k]) => k === key).map(([, v]) => v);
}

export class LoathingDate {
  static EPOCH = new Date(Date.UTC(2003, 1, 10, 3, 30));
  // The epoch is not Jarlsuary 1 Year 1 — gameday 0 falls 9 days into
  // the KoL calendar, so we offset when converting between gameday and
  // KoL year/month/date.
  static CALENDAR_OFFSET = 9;
  static BLACK_SUNDAY = 545; // August 8, 2004
  static WHITE_WEDNESDAY = 989; // October 26, 2005
  static COLLISION = 1209; // June 3, 2006 — comet created Hamburglar

  static getDaysSinceEpoch(kolYear: number, kolMonth: number, kolDate: number) {
    return (
      (kolYear - 1) * 96 +
      kolMonth * 8 +
      (kolDate - 1) -
      LoathingDate.CALENDAR_OFFSET
    );
  }

  private static MS_PER_DAY = 24 * 60 * 60 * 1_000;

  static gameDayFromRealDate(realDate: Date) {
    return Math.floor(
      (realDate.getTime() - LoathingDate.EPOCH.getTime()) /
        LoathingDate.MS_PER_DAY,
    );
  }

  static getRollover(date = new Date()): Date {
    const gameday = LoathingDate.gameDayFromRealDate(date);
    return new Date(
      LoathingDate.EPOCH.getTime() + gameday * LoathingDate.MS_PER_DAY,
    );
  }

  static getNextRollover(date = new Date()): Date {
    const gameday = LoathingDate.gameDayFromRealDate(date);
    return new Date(
      LoathingDate.EPOCH.getTime() + (gameday + 1) * LoathingDate.MS_PER_DAY,
    );
  }

  isAprilFools(): boolean {
    const realDate = this.toRealDate();
    return realDate.getUTCMonth() === 3 && realDate.getUTCDate() === 1;
  }

  #year: number;
  #month: number;
  #date: number;
  #realDate: Date;

  constructor();
  constructor(gameday: number);
  constructor(realDate: Date);
  constructor(kolYear: number, kolMonth: number, kolDate: number);
  constructor(
    first: Date | number = new Date(),
    kolMonth?: number,
    kolDate?: number,
  ) {
    const gameday =
      first instanceof Date
        ? LoathingDate.gameDayFromRealDate(first)
        : kolMonth !== undefined && kolDate !== undefined
          ? LoathingDate.getDaysSinceEpoch(first, kolMonth, kolDate)
          : first;

    this.#realDate = addDays(LoathingDate.EPOCH.getTime(), gameday);
    this.#realDate.setUTCHours(LoathingDate.EPOCH.getUTCHours());
    const calendarDay = gameday + LoathingDate.CALENDAR_OFFSET;
    this.#year = Math.floor(calendarDay / 96) + 1;
    this.#month = Math.floor((calendarDay % 96) / 8);
    this.#date = Math.floor(calendarDay % 8) + 1;
  }

  getYear() {
    return this.#year;
  }

  getMonth() {
    return this.#month;
  }

  getMonthName() {
    return [
      "Jarlsuary",
      "Frankuary",
      "Starch",
      "April",
      "Martinus",
      "Bill",
      "Bor",
      "Petember",
      "Carlvember",
      "Porktober",
      "Boozember",
      "Dougtember",
    ][this.#month % 12];
  }

  getDate() {
    return this.#date;
  }

  toRealDate() {
    return this.#realDate;
  }

  getDaysSinceEpoch() {
    return LoathingDate.getDaysSinceEpoch(
      this.getYear(),
      this.getMonth(),
      this.getDate(),
    );
  }

  getPhase() {
    return (this.getMonth() * 8 + (this.getDate() - 1)) % 16;
  }

  getPhaseDescription(phase: number) {
    switch (phase) {
      case 0:
        return "new";
      case 1:
        return "waxing crescent";
      case 2:
        return "first quarter";
      case 3:
        return "waxing gibbous";
      case 4:
        return "full";
      case 5:
        return "waning gibbous";
      case 6:
        return "last quarter";
      case 7:
        return "waning crescent";
      default:
        return "missing";
    }
  }

  getLightFromPhase(phase: number) {
    return 4 - Math.abs(phase - 4);
  }

  getRonaldPhase() {
    return this.getPhase() % 8;
  }

  getRonaldPhaseDescription() {
    return this.getPhaseDescription(this.getRonaldPhase());
  }

  getGrimacePhase() {
    return Math.floor(this.getPhase() / 2);
  }

  getGrimacePhaseDescription() {
    return this.getPhaseDescription(this.getGrimacePhase());
  }

  getHamburglarPhase() {
    const cycle = this.getDaysSinceEpoch() - LoathingDate.COLLISION;
    if (cycle < 0) return null;
    return (cycle * 2) % 11;
  }

  getHamburglarPhaseDescription() {
    switch (this.getHamburglarPhase()) {
      case 0:
        return "in front of Grimace's left side";
      case 1:
        return "in front of Grimace's right side";
      case 2:
        return "heading behind Grimace";
      case 3:
        return "hidden behind Grimace";
      case 4:
        return "appering from behind Grimace";
      case 5:
        return "disppering behind Ronald";
      case 6:
        return "hidden behind Ronald";
      case 7:
        return "returning from behind Ronald";
      case 8:
        return "in front of Ronald's left side";
      case 9:
        return "in front of Ronald's right side";
      case 10:
        return "front and center";
      default:
        return "in an unknown location";
    }
  }

  getHamburglarLight() {
    const g = this.getGrimacePhase();
    const r = this.getRonaldPhase();
    switch (this.getHamburglarPhase()) {
      case 0:
        return g > 0 && g < 5 ? -1 : 1;
      case 1:
        return g < 4 ? 1 : -1;
      case 2:
        return g > 3 ? 1 : 0;
      case 4:
        return g > 0 && g < 5 ? 1 : 0;
      case 5:
        return r > 3 ? 1 : 0;
      case 7:
        return r > 0 && r < 5 ? 1 : 0;
      case 8:
        return r > 0 && r < 5 ? -1 : 1;
      case 9:
        return r < 4 ? 1 : -1;
      case 10:
        return (r > 3 ? 1 : 0) + (g > 0 && g < 5 ? 1 : 0);
      default:
        return 0;
    }
  }

  getStatDay() {
    const phase = this.getPhase();
    if (MUSCLE_PHASES.has(phase)) return "Muscle Day";
    if (MYSTICALITY_PHASES.has(phase)) return "Mysticality Day";
    if (MOXIE_PHASES.has(phase)) return "Moxie Day";
    return null;
  }

  getHolidays() {
    const holidays = new Set<string>();

    const gameHoliday = GAME_HOLIDAYS.get(`${this.#month},${this.#date}`);
    if (gameHoliday) holidays.add(gameHoliday);

    for (const h of getRealWorldHolidays(this.#realDate)) holidays.add(h);

    // Combination holidays replace their components
    if (
      holidays.has("St. Sneaky Pete's Day") &&
      holidays.has("Feast of Boris")
    ) {
      holidays.delete("St. Sneaky Pete's Day");
      holidays.delete("Feast of Boris");
      holidays.add("Drunksgiving");
    }

    if (
      holidays.has("Feast of Boris") &&
      holidays.has("El Dia De Los Muertos Borrachos")
    ) {
      holidays.delete("Feast of Boris");
      holidays.delete("El Dia De Los Muertos Borrachos");
      holidays.add("El Dia De Los Muertos Borrachos y Agradecido");
    }

    const gameday = this.getDaysSinceEpoch();
    if (gameday === LoathingDate.BLACK_SUNDAY) holidays.add("Black Sunday");
    if (gameday === LoathingDate.WHITE_WEDNESDAY)
      holidays.add("White Wednesday");
    if (gameday === LoathingDate.COLLISION) holidays.add("The Comet");

    const statDay = this.getStatDay();
    if (statDay) holidays.add(statDay);

    return [...holidays];
  }

  getMoonlight() {
    return (
      this.getLightFromPhase(this.getRonaldPhase()) +
      this.getLightFromPhase(this.getGrimacePhase()) +
      this.getHamburglarLight()
    );
  }

  getMoonDescription() {
    return `Ronald is ${this.getRonaldPhaseDescription()}, Grimace is ${this.getGrimacePhaseDescription()}, and Hamburglar is ${this.getHamburglarPhaseDescription()}. In total the moonlight is of strength ${this.getMoonlight()}.`;
  }

  getMoonsAsSvg() {
    const R = 15;
    const CY = 25;
    const RONALD_CX = 25;
    const GRIMACE_CX = 85;

    // Hamburglar centre per phase (null = hidden behind a moon). The "side"
    // positions sit on the outer quarter of the disc so they read clearly as
    // in front of the moon's left or right.
    const SIDE = R * 0.75;
    const hamburglarCentres = [
      GRIMACE_CX - SIDE, // 0: in front of Grimace's left side
      GRIMACE_CX + SIDE, // 1: in front of Grimace's right side
      GRIMACE_CX + R, // 2: heading behind Grimace
      null, // 3: hidden behind Grimace
      GRIMACE_CX - R, // 4: appearing from behind Grimace
      RONALD_CX + R, // 5: disappearing behind Ronald
      null, // 6: hidden behind Ronald
      RONALD_CX - R, // 7: returning from behind Ronald
      RONALD_CX - SIDE, // 8: in front of Ronald's left side
      RONALD_CX + SIDE, // 9: in front of Ronald's right side
      (RONALD_CX + GRIMACE_CX) / 2, // 10: front and centre
    ];

    const hamburglarPhase = this.getHamburglarPhase();
    const hamburglarCentre =
      hamburglarPhase !== null ? hamburglarCentres[hamburglarPhase] : null;
    const hamburglarSymbol = this.getHamburglarLight() > 0 ? 4 : 0;

    const ronaldPhase = this.getRonaldPhase();
    const grimacePhase = this.getGrimacePhase();

    const neededPhases = new Set([ronaldPhase, grimacePhase]);
    if (hamburglarCentre !== null) neededPhases.add(hamburglarSymbol);

    const defs = [...neededPhases]
      .map(
        (p) =>
          `<symbol id="moon-${p}" viewBox="0 0 128 128">${moonSymbols[p]}</symbol>`,
      )
      .join("\n    ");

    const moon = (id: string, cx: number, phase: number) =>
      `<use id="${id}" href="#moon-${phase}" x="${cx - R}" y="${CY - R}" width="${2 * R}" height="${2 * R}"/>`;

    return dedent`
      <?xml version="1.0" encoding="UTF-8" standalone="no"?>
      <svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="110" height="50" viewBox="0 0 110 50">
        <defs>
          ${defs}
        </defs>
        ${moon("ronald", RONALD_CX, ronaldPhase)}
        ${moon("grimace", GRIMACE_CX, grimacePhase)}
        ${
          hamburglarCentre !== null
            ? `<use id="hamburglar" href="#moon-${hamburglarSymbol}" x="${hamburglarCentre - 5}" y="${CY - 5}" width="10" height="10"/>`
            : ""
        }
      </svg>
    `;
  }

  toString() {
    return `${this.getMonthName()} ${this.getDate()} Year ${this.getYear()}`;
  }

  toShortString() {
    return `${this.getYear()}-${this.getMonthName().slice(
      0,
      3,
    )}-${this.getDate()}`.toUpperCase();
  }
}
