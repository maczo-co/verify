// originals-tome-of-life ("Crystal Codex") — pure resolver. Mirrors the ReelSlot engine in
// libs/game_math/reelslots.py (TOME_OF_LIFE config).
//
// A 5×3 grid is drawn from weighted reels; up to 20 selectable paylines pay left-to-right with WILD
// substitution (the wild has its own paytable and doubles substituted combos); three+ scatters trigger
// 15 free spins ×3 that retrigger up to a 180-spin cap; a Bonus Buy resolves the bonus for a 37× price.
//
// The exact-rational scale factor is precomputed by the server (paytable.scale = {num,den}); the final
// multiplier is one BigInt floor: floor(scale · rel · 1e8), with `rel` a rational over the active lines.
//
// SPDX-License-Identifier: MIT
import { payoutMinor, E8 } from "@maczo/originals-verify";

export const game = "tome-of-life";
export const biasClass = "modulo";

const REELS = 5, ROWS = 3, CELLS = REELS * ROWS; // 15
const E8N = 100000000n;
// Worst-case stream: 1 base spin + up to fsCap (180) free spins, each CELLS cells. The uint32 stream is
// a stable prefix, so requesting this upper bound is always safe (resolve slices only what it needs).
const MAX_SEGMENTS = 1 + 180;

export function uintsNeeded(params) {
  return params && params.bonus_buy ? CELLS * 180 : CELLS * MAX_SEGMENTS;
}

// ---- tiny exact BigInt rational -----------------------------------------------------------------
function gcd(a, b) {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a || 1n;
}
class Frac {
  constructor(n, d = 1n) {
    n = BigInt(n);
    d = BigInt(d);
    if (d < 0n) { n = -n; d = -d; }
    const g = gcd(n, d);
    this.n = n / g;
    this.d = d / g;
  }
  add(o) { return new Frac(this.n * o.d + o.n * this.d, this.d * o.d); }
  mul(o) { return new Frac(this.n * o.n, this.d * o.d); }
}
const floorFE8 = (f) => Number((f.n * E8N) / f.d); // int(f · 1e8), f >= 0

// ---- reel mechanics (mirror reelslots.py) -------------------------------------------------------
function pick(u, cfg) {
  let r = u % cfg.wtotal;
  for (let s = 0; s < cfg.weights.length; s++) {
    r -= cfg.weights[s];
    if (r < 0) return s;
  }
  return cfg.weights.length - 1;
}

function gridFrom(seg, cfg) {
  const reels = [];
  for (let reel = 0; reel < REELS; reel++) {
    const col = [];
    for (let row = 0; row < ROWS; row++) col.push(pick(seg[reel * ROWS + row], cfg));
    reels.push(col);
  }
  return reels; // reel-major: reels[reel][row]
}

function linePay(syms, cfg) {
  let j = 0;
  while (j < REELS && syms[j] === cfg.wild) j++;
  const wildTbl = cfg.wildPay;
  if (j === REELS) return wildTbl[String(REELS)] ?? 0; // whole line of wilds
  const payWild = wildTbl[String(j)] ?? 0; // leading wilds as their own symbol
  const sym = syms[j];
  if (sym === cfg.scatter) return payWild;
  let run = 0;
  let usedWild = false;
  for (const c of syms) {
    if (c === sym || c === cfg.wild) {
      usedWild = usedWild || c === cfg.wild;
      run++;
    } else break;
  }
  let base = (cfg.runPay[String(sym)] && cfg.runPay[String(sym)][String(run)]) || 0;
  if (usedWild && cfg.wildDouble) base *= 2;
  return Math.max(base, payWild);
}

function lineWins(reels, cfg, active) {
  const wins = [];
  let total = 0;
  const paylines = cfg.paylines.slice(0, active);
  for (let idx = 0; idx < paylines.length; idx++) {
    const line = paylines[idx];
    const syms = line.map((row, reel) => reels[reel][row]);
    const pay = linePay(syms, cfg);
    if (pay <= 0) continue;
    total += pay;
    let j = 0;
    while (j < REELS && syms[j] === cfg.wild) j++;
    const sym = j === REELS ? cfg.wild : syms[j];
    let run = 0;
    for (const c of syms) {
      if (c === sym || c === cfg.wild) run++;
      else break;
    }
    wins.push({ line: idx, sym, run, pay, cells: Array.from({ length: run }, (_, reel) => [reel, line[reel]]) });
  }
  return [wins, total];
}

function scatterCount(reels, cfg) {
  let n = 0;
  for (const col of reels) for (const c of col) if (c === cfg.scatter) n++;
  return n;
}

function scatterRelpay(cfg, k) {
  const keys = Object.keys(cfg.scatterPay).map(Number);
  const minK = Math.min(...keys);
  const maxK = Math.max(...keys);
  if (k < minK) return 0;
  return cfg.scatterPay[String(Math.min(k, maxK))] ?? 0;
}

function bonusSpins(cfg, us, scale, active, startSeg) {
  let rel = new Frac(0n);
  const spins = [];
  let totalSpins = cfg.freeSpins;
  let i = 0;
  while (i < totalSpins) {
    const seg = us.slice(CELLS * (startSeg + i), CELLS * (startSeg + i + 1));
    const fr = gridFrom(seg, cfg);
    const [fw] = lineWins(fr, cfg, active);
    let spinRel = new Frac(0n);
    for (const w of fw) {
      const exempt = cfg.fsExemptWild5 && w.sym === cfg.wild && w.run === REELS;
      spinRel = spinRel.add(new Frac(BigInt(w.pay), BigInt(active)).mul(new Frac(BigInt(exempt ? 1 : cfg.fsMult))));
    }
    const fscat = scatterCount(fr, cfg);
    if (cfg.fsScatterPays) {
      spinRel = spinRel.add(new Frac(BigInt(scatterRelpay(cfg, fscat))).mul(new Frac(BigInt(cfg.fsMult))));
    }
    let retriggered = false;
    if (cfg.fsRetrigger && fscat >= cfg.fsTrigger && totalSpins < cfg.fsCap) {
      totalSpins = Math.min(totalSpins + cfg.freeSpins, cfg.fsCap);
      retriggered = true;
    }
    rel = rel.add(spinRel);
    spins.push({ reels: fr, lines: fw, scatter: fscat, retriggered, multiplier_e8: floorFE8(scale.mul(spinRel)) });
    i++;
  }
  return [spins, rel];
}

export function resolve(uints, params, paytable, opts = {}) {
  const betMinor = opts.betMinor ?? 100000000;
  const cfg = paytable;
  const scale = new Frac(BigInt(cfg.scale.num), BigInt(cfg.scale.den));
  const active = cfg.selectableLines ? Number(params.lines ?? cfg.lines) : cfg.lines;

  if (params.bonus_buy) {
    const [spins, rel] = bonusSpins(cfg, uints, scale, active, 0);
    const prod = scale.mul(rel);
    let multE8 = Number((prod.n * E8N) / (prod.d * BigInt(cfg.bonusBuyMult)));
    if (cfg.maxWinMult) multE8 = Math.min(multE8, cfg.maxWinMult * Number(E8));
    return {
      multiplierE8: multE8,
      win: multE8 > 0,
      payoutMinor: payoutMinor(betMinor, multE8),
      outcome: {
        bonus_buy: true, price_mult: cfg.bonusBuyMult, lines_active: active,
        free_spins: spins, spins_total: spins.length, total_rel_e8: floorFE8(scale.mul(rel)),
        wild: cfg.wild, scatter_sym: cfg.scatter, multiplier_e8: multE8,
      },
    };
  }

  const reels = gridFrom(uints.slice(0, CELLS), cfg);
  const [lineW, lineSum] = lineWins(reels, cfg, active);
  const scatters = scatterCount(reels, cfg);
  const scatterPos = [];
  for (let r = 0; r < REELS; r++) for (let i = 0; i < ROWS; i++) if (reels[r][i] === cfg.scatter) scatterPos.push([r, i]);

  let rel = new Frac(BigInt(lineSum), BigInt(active));
  const scatterRel = scatterRelpay(cfg, scatters);
  rel = rel.add(new Frac(BigInt(scatterRel)));

  let freeSpins = [];
  const triggered = scatters >= cfg.fsTrigger && cfg.freeSpins > 0;
  if (triggered) {
    const [fs, fsRel] = bonusSpins(cfg, uints, scale, active, 1);
    freeSpins = fs;
    rel = rel.add(fsRel);
  }
  let multE8 = floorFE8(scale.mul(rel));
  if (cfg.maxWinMult) multE8 = Math.min(multE8, cfg.maxWinMult * Number(E8));
  for (const w of lineW) w.multiplier_e8 = floorFE8(scale.mul(new Frac(BigInt(w.pay), BigInt(active))));

  return {
    multiplierE8: multE8,
    win: multE8 > 0,
    payoutMinor: payoutMinor(betMinor, multE8),
    outcome: {
      reels, lines: lineW, paylines: cfg.paylines.slice(0, active), lines_active: active,
      scatter: scatters, scatter_cells: scatterPos,
      scatter_multiplier_e8: floorFE8(scale.mul(new Frac(BigInt(scatterRel)))),
      free_spins: freeSpins, fs_triggered: triggered, wild: cfg.wild, scatter_sym: cfg.scatter,
      multiplier_e8: multE8,
    },
  };
}
