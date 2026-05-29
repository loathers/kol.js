import { EmbeddedActionsParser, Lexer, createToken } from "chevrotain";

import type { ExpressionContext } from "./types.js";

// Pre-process: quote bare identifier args in string-argument functions
// e.g. skill(Accordion Appreciation) -> skill("Accordion Appreciation")
// e.g. pref(locketPhylum,demon) -> pref("locketPhylum","demon")
function preprocess(expr: string): string {
  return expr.replace(
    /\b(skill|zone|loc|env|path|equipped|pref)\(([^)]*)\)/g,
    (_, fn: string, argsRaw: string) => {
      const args = argsRaw.split(",").map((a) => {
        a = a.trim();
        if (/^-?\d+(\.\d+)?$/.test(a)) return a;
        return `"${a}"`;
      });
      return `${fn}(${args.join(",")})`;
    },
  );
}

const WhiteSpace = createToken({
  name: "WhiteSpace",
  pattern: /\s+/,
  group: Lexer.SKIPPED,
});
const NumberLiteral = createToken({
  name: "NumberLiteral",
  pattern: /\d+\.?\d*|\.\d+/,
});
const StringLiteral = createToken({
  name: "StringLiteral",
  pattern: /"[^"]*"/,
});

// Keywords must come before Variable since Variable only matches [A-Z],
// and all keywords are lowercase — no ordering conflict needed.
const Unarmed = createToken({ name: "Unarmed", pattern: /unarmed/ });
const FloorFn = createToken({ name: "FloorFn", pattern: /floor/ });
const CeilFn = createToken({ name: "CeilFn", pattern: /ceil/ });
const MinFn = createToken({ name: "MinFn", pattern: /min/ });
const MaxFn = createToken({ name: "MaxFn", pattern: /max/ });
const LteFn = createToken({ name: "LteFn", pattern: /lte/ });
const GteFn = createToken({ name: "GteFn", pattern: /gte/ });
const SkillFn = createToken({ name: "SkillFn", pattern: /skill/ });
const ZoneFn = createToken({ name: "ZoneFn", pattern: /zone/ });
const LocFn = createToken({ name: "LocFn", pattern: /loc/ });
const EnvFn = createToken({ name: "EnvFn", pattern: /env/ });
const PathFn = createToken({ name: "PathFn", pattern: /path/ });
const EquippedFn = createToken({ name: "EquippedFn", pattern: /equipped/ });
const PrefFn = createToken({ name: "PrefFn", pattern: /pref/ });

// Single uppercase letter (L, M, G…) or multi-letter lowercase name (paradoxicity…)
// Must come after all keyword tokens so keywords take precedence on same-length matches
const Variable = createToken({ name: "Variable", pattern: /[A-Z]|[a-z][a-z0-9_]*/ });
const Plus = createToken({ name: "Plus", pattern: /\+/ });
const Minus = createToken({ name: "Minus", pattern: /-/ });
const Star = createToken({ name: "Star", pattern: /\*/ });
const Slash = createToken({ name: "Slash", pattern: /\// });
const Caret = createToken({ name: "Caret", pattern: /\^/ });
const LParen = createToken({ name: "LParen", pattern: /\(/ });
const RParen = createToken({ name: "RParen", pattern: /\)/ });
const Comma = createToken({ name: "Comma", pattern: /,/ });

const ALL_TOKENS = [
  WhiteSpace,
  NumberLiteral,
  StringLiteral,
  Unarmed,
  FloorFn,
  CeilFn,
  MinFn,
  MaxFn,
  LteFn,
  GteFn,
  SkillFn,
  ZoneFn,
  LocFn,
  EnvFn,
  PathFn,
  EquippedFn,
  PrefFn,
  Variable,
  Plus,
  Minus,
  Star,
  Slash,
  Caret,
  LParen,
  RParen,
  Comma,
];

const expressionLexer = new Lexer(ALL_TOKENS);

class KolExpressionParser extends EmbeddedActionsParser {
  context: ExpressionContext = {
    prefs: {},
    skills: new Set(),
    equipment: new Map(),
  };

  constructor() {
    super(ALL_TOKENS);
    this.performSelfAnalysis();
  }

  expression = this.RULE("expression", (): number => {
    return this.SUBRULE(this.additive);
  });

  private additive = this.RULE("additive", (): number => {
    let result = this.SUBRULE(this.multiplicative);
    this.MANY(() => {
      const op = this.OR<string>([
        { ALT: () => { this.CONSUME(Plus); return "+"; } },
        { ALT: () => { this.CONSUME(Minus); return "-"; } },
      ]);
      const right = this.SUBRULE2(this.multiplicative);
      if (op === "+") result += right;
      else result -= right;
    });
    return result;
  });

  private multiplicative = this.RULE("multiplicative", (): number => {
    let result = this.SUBRULE(this.power);
    this.MANY(() => {
      const op = this.OR<string>([
        { ALT: () => { this.CONSUME(Star); return "*"; } },
        { ALT: () => { this.CONSUME(Slash); return "/"; } },
      ]);
      const right = this.SUBRULE2(this.power);
      if (op === "*") result *= right;
      else result /= right;
    });
    return result;
  });

  private power = this.RULE("power", (): number => {
    const base = this.SUBRULE(this.unary);
    return this.OPTION(() => {
      this.CONSUME(Caret);
      const exp = this.SUBRULE2(this.unary);
      return Math.pow(base, exp);
    }) ?? base;
  });

  private unary = this.RULE("unary", (): number => {
    return this.OR<number>([
      {
        ALT: () => {
          this.CONSUME(Minus);
          return -this.SUBRULE(this.unary);
        },
      },
      {
        ALT: () => {
          this.CONSUME(Plus);
          return this.SUBRULE2(this.unary);
        },
      },
      { ALT: () => this.SUBRULE3(this.primary) },
    ]);
  });

  private primary = this.RULE("primary", (): number => {
    return this.OR<number>([
      {
        ALT: () => {
          this.CONSUME(LParen);
          const val = this.SUBRULE(this.expression);
          this.CONSUME(RParen);
          return val;
        },
      },
      { ALT: () => parseFloat(this.CONSUME2(NumberLiteral).image) },
      { ALT: () => this.SUBRULE2(this.variableExpr) },
      { ALT: () => this.SUBRULE3(this.callExpr) },
      {
        ALT: () => {
          this.CONSUME(Unarmed);
          return this.context.equipment.has("weapon") ? 0 : 1;
        },
      },
    ]);
  });

  private variableExpr = this.RULE("variableExpr", (): number => {
    const token = this.CONSUME(Variable);
    return this.resolveVariable(token.image);
  });

  private callExpr = this.RULE("callExpr", (): number => {
    return this.OR<number>([
      { ALT: () => this.SUBRULE(this.mathCall) },
      { ALT: () => this.SUBRULE2(this.stringArgCall) },
      { ALT: () => this.SUBRULE3(this.prefCall) },
    ]);
  });

  private mathCall = this.RULE("mathCall", (): number => {
    const fn = this.OR<string>([
      { ALT: () => { this.CONSUME(FloorFn); return "floor"; } },
      { ALT: () => { this.CONSUME(CeilFn); return "ceil"; } },
      { ALT: () => { this.CONSUME(MinFn); return "min"; } },
      { ALT: () => { this.CONSUME(MaxFn); return "max"; } },
      { ALT: () => { this.CONSUME(LteFn); return "lte"; } },
      { ALT: () => { this.CONSUME(GteFn); return "gte"; } },
    ]);
    this.CONSUME(LParen);
    const a = this.SUBRULE(this.expression);
    let b: number | undefined;
    this.OPTION(() => {
      this.CONSUME(Comma);
      b = this.SUBRULE2(this.expression);
    });
    this.CONSUME(RParen);

    switch (fn) {
      case "floor": return Math.floor(a);
      case "ceil": return Math.ceil(a);
      case "min": return Math.min(a, b ?? a);
      case "max": return Math.max(a, b ?? a);
      case "lte": return a <= (b ?? 0) ? 1 : 0;
      case "gte": return a >= (b ?? 0) ? 1 : 0;
      default: return 0;
    }
  });

  private stringArgCall = this.RULE("stringArgCall", (): number => {
    const fn = this.OR<string>([
      { ALT: () => { this.CONSUME(SkillFn); return "skill"; } },
      { ALT: () => { this.CONSUME(ZoneFn); return "zone"; } },
      { ALT: () => { this.CONSUME(LocFn); return "loc"; } },
      { ALT: () => { this.CONSUME(EnvFn); return "env"; } },
      { ALT: () => { this.CONSUME(PathFn); return "path"; } },
      { ALT: () => { this.CONSUME(EquippedFn); return "equipped"; } },
    ]);
    this.CONSUME(LParen);
    const raw = this.CONSUME(StringLiteral).image;
    const arg = raw.slice(1, -1);
    this.CONSUME(RParen);

    const ctx = this.context;
    switch (fn) {
      case "skill": return ctx.skills.has(arg) ? 1 : 0;
      case "zone": return ctx.location?.zone === arg ? 1 : 0;
      case "loc": return ctx.location?.name === arg ? 1 : 0;
      case "env": return ctx.location?.environment === arg ? 1 : 0;
      case "path": return ctx.path?.name === arg ? 1 : 0;
      case "equipped": return [...ctx.equipment.values()].some((item) => item.name === arg) ? 1 : 0;
      default: return 0;
    }
  });

  private prefCall = this.RULE("prefCall", (): number => {
    this.CONSUME(PrefFn);
    this.CONSUME(LParen);
    const nameRaw = this.CONSUME(StringLiteral).image;
    const name = nameRaw.slice(1, -1);
    let matchArg: string | number | undefined;
    this.OPTION(() => {
      this.CONSUME(Comma);
      matchArg = this.OR2<string | number>([
        {
          ALT: () => {
            const raw = this.CONSUME2(StringLiteral).image;
            return raw.slice(1, -1);
          },
        },
        { ALT: () => parseFloat(this.CONSUME2(NumberLiteral).image) },
      ]);
    });
    this.CONSUME(RParen);

    const prefValue = this.context.prefs[name];
    if (matchArg !== undefined) {
      // Match form: returns 1 if pref equals matchArg
      return String(prefValue) === String(matchArg) ? 1 : 0;
    }
    return Number(prefValue ?? 0);
  });

  private resolveVariable(name: string): number {
    const val = this.context.variables?.[name];
    if (val !== undefined) return val;
    if (this.context.strict) throw new Error(`Unknown variable: ${name}`);
    return 0;
  }
}

const parser = new KolExpressionParser();

export function evaluate(expr: string, context: ExpressionContext): number {
  const preprocessed = preprocess(expr);
  const { tokens, errors: lexErrors } = expressionLexer.tokenize(preprocessed);

  if (lexErrors.length > 0) {
    if (context.strict) throw new Error(`Lex error in expression "${expr}": ${lexErrors[0].message}`);
    return 0;
  }

  parser.context = context;
  parser.input = tokens;
  const result = parser.expression();

  if (parser.errors.length > 0) {
    if (context.strict) throw new Error(`Parse error in expression "${expr}": ${parser.errors[0].message}`);
    return 0;
  }

  return result ?? 0;
}
