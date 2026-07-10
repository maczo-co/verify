// originals-packs — pure resolver. Mirrors libs/game_math/packs.py.
//
// Rip open a pack of 5 cards. Each card's multiplier tier is chosen by an integer threshold lookup on
// the raw uint (bisect_right: tier = number of thresholds <= u — no modulo bias). The pack payout is
// the sum of the 5 card multipliers; the minimum card pays > 0, so a pack payout is never 0.
//
// SPDX-License-Identifier: MIT
import { payoutMinor } from "@maczo/originals-verify";

export const game = "packs";
export const biasClass = "modulo";

export function uintsNeeded() {
  return 5;
}

export function resolve(uints, params, paytable, opts = {}) {
  const betMinor = opts.betMinor ?? 100000000;
  const thresholds = paytable.thresholds; // ascending; last == 2^32
  const tiers = paytable.tiers;

  const cards_e8 = [];
  for (let i = 0; i < 5; i++) {
    const u = uints[i];
    let t = 0; // bisect_right(thresholds, u): count of thresholds <= u
    while (t < thresholds.length && u >= thresholds[t]) t++;
    cards_e8.push(tiers[t].cardE8);
  }

  const multiplierE8 = cards_e8.reduce((a, b) => a + b, 0);
  const win = multiplierE8 >= 100000000; // net-win display (>= 1x)
  return {
    multiplierE8,
    win,
    payoutMinor: payoutMinor(betMinor, multiplierE8), // always credits (> 0)
    outcome: { cards_e8, multiplier_e8: multiplierE8 },
  };
}
