// originals-keno — pure resolver. Mirrors libs/game_math/keno.py.
//
// Pick 1–10 numbers from 1..40; a deterministic Fisher-Yates of 0..39 (shuffle) draws the first 10.
// Payout scales with how many of your picks were drawn (matches), indexing the baked per-hit row for
// `${difficulty}/${spots}`. Any positive multiplier is a win (a 0-hit consolation is a real credit).
//
// SPDX-License-Identifier: MIT
import { shuffle, payoutMinor } from "@maczo/originals-verify";

export const game = "keno";
export const biasClass = "uniform";

const POOL = 40;
const DRAW = 10;

export function uintsNeeded() {
  return POOL - 1; // 39
}

export function resolve(uints, params, paytable, opts = {}) {
  const betMinor = opts.betMinor ?? 100000000;
  const picks = params.picks;
  const spots = picks.length;
  const difficulty = params.difficulty || "medium";

  const order = shuffle(POOL, uints);
  const drawn = new Set(order.slice(0, DRAW)); // indices 0..39
  const picks0 = picks.map((p) => p - 1);
  const matches = picks0.filter((p) => drawn.has(p)).length;

  const variant = paytable.variants[`${difficulty}/${spots}`];
  if (!variant) throw new Error(`keno: no variant ${difficulty}/${spots}`);
  const multiplierE8 = variant.perHit[matches];

  const win = multiplierE8 > 0;
  const payout = payoutMinor(betMinor, multiplierE8);

  return {
    multiplierE8,
    win,
    payoutMinor: payout,
    outcome: {
      drawn: [...drawn].map((n) => n + 1).sort((a, b) => a - b),
      picks: [...picks].sort((a, b) => a - b),
      matches,
      difficulty,
      multiplier_e8: multiplierE8,
    },
  };
}
