// originals-slots — pure resolver. Mirrors libs/game_math/slots.py.
//
// 5 reels × 3 rows. 15 symbols are drawn independently by weight (index 0 most common … 7 rarest).
// Each of the 3 rows is an independent left-aligned payline: it pays on a run of ≥3 matching symbols
// from the LEFT, via the baked runMultiplierE8[symbol][run]. The three row multipliers add up.
//
// SPDX-License-Identifier: MIT
import { payoutMinor } from "@maczo/originals-verify";

export const game = "slots";
export const biasClass = "modulo";

const REELS = 5;
const ROWS = 3;

export function uintsNeeded() {
  return 15; // 5×3 independent symbol draws
}

export function resolve(uints, params, paytable, opts = {}) {
  const betMinor = opts.betMinor ?? 100000000;
  const weights = paytable.weights; // length 8
  const nsym = weights.length;
  const wtotal = weights.reduce((a, b) => a + b, 0);

  const pick = (u) => {
    let r = u % wtotal;
    for (let s = 0; s < nsym; s++) {
      r -= weights[s];
      if (r < 0) return s;
    }
    return nsym - 1;
  };

  const syms = new Array(15);
  for (let i = 0; i < 15; i++) syms[i] = pick(uints[i]);

  const grid = [];
  for (let r = 0; r < ROWS; r++) grid.push(syms.slice(r * REELS, (r + 1) * REELS)); // row-major

  const lines = [];
  let total = 0;
  for (let r = 0; r < ROWS; r++) {
    const row = grid[r];
    let run = 1;
    for (let i = 1; i < REELS; i++) {
      if (row[i] === row[0]) run += 1;
      else break;
    }
    const lineMultE8 = run < 3 ? 0 : paytable.runMultiplierE8[String(row[0])][String(run)];
    total += lineMultE8;
    if (lineMultE8 > 0) {
      lines.push({ row: r, run, symbol: row[0], multiplier_e8: lineMultE8 });
    }
  }

  const win = total > 0;
  const payout = payoutMinor(betMinor, total);

  return {
    multiplierE8: total,
    win,
    payoutMinor: payout,
    outcome: {
      grid,
      lines,
      multiplier_e8: total,
    },
  };
}
