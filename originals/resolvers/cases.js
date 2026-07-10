// originals-cases — pure resolver. Mirrors libs/game_math/cases.py.
//
// One uint32 word picks a slot in [0, SLOTS); walking the baked cumulative weights (cum) lands on one
// weighted multiplier tier. Faces are pre-baked e8 (do NOT recompute the Fraction scaling here).
//
// SPDX-License-Identifier: MIT
import { payoutMinor } from "@maczo/originals-verify";

export const game = "cases";
export const biasClass = "modulo";

export function uintsNeeded() {
  return 1;
}

export function resolve(uints, params, paytable, opts = {}) {
  const betMinor = opts.betMinor ?? 100000000;
  const { difficulty } = params;
  const d = paytable.difficulty[difficulty];
  if (!d) throw new Error(`cases: no difficulty ${difficulty}`);
  const { tiers, cum } = d;

  const slot = uints[0] % paytable.slots; // SLOTS === 1_000_000
  let idx = tiers.length - 1; // last tier is the closing band (unreachable fallthrough in Python)
  for (let i = 0; i < cum.length; i++) {
    if (slot < cum[i]) {
      idx = i;
      break;
    }
  }
  const multiplierE8 = tiers[idx].multiplierE8;
  const win = multiplierE8 > 0;
  const payout = payoutMinor(betMinor, multiplierE8);

  return {
    multiplierE8,
    win,
    payoutMinor: payout,
    outcome: { difficulty, slot, multiplier_e8: multiplierE8 },
  };
}
