// originals-diamonds — pure resolver. Mirrors libs/game_math/diamonds.py.
//
// Draw 5 gems from 7 colors (gem = u mod 7). The multiplicity pattern (counts sorted desc, e.g. a
// pair is "2-1-1-1") selects the baked multiplier from paytable.patterns. A 0.1x pair still "wins".
//
// SPDX-License-Identifier: MIT
import { payoutMinor } from "@maczo/originals-verify";

export const game = "diamonds";
export const biasClass = "modulo";

export function uintsNeeded() {
  return 5;
}

export function resolve(uints, params, paytable, opts = {}) {
  const betMinor = opts.betMinor ?? 100000000;

  const gems = uints.slice(0, 5).map((u) => u % 7);
  const counts = {};
  for (const g of gems) counts[g] = (counts[g] || 0) + 1;
  const pattern = Object.values(counts)
    .sort((a, b) => b - a)
    .join("-");

  const entry = paytable.patterns[pattern];
  const multiplierE8 = entry.multiplierE8;
  const win = multiplierE8 > 0;
  return {
    multiplierE8,
    win,
    payoutMinor: payoutMinor(betMinor, multiplierE8),
    outcome: { gems, pattern: entry.label, multiplier_e8: multiplierE8 },
  };
}
