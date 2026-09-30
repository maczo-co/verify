// originals-fortune-wheel — pure resolver. Mirrors libs/game_math/fortune_wheel.py (the wheel recipe under its own id).
//
// One uint32 word lands the wheel on one of N equal segments (uint % segments). The fixed, published
// arrangement (table_e8) maps slot → multiplier. Zero wedges are real losses (payout 0).
//
// SPDX-License-Identifier: MIT
import { payoutMinor } from "@maczo/originals-verify";

export const game = "fortune-wheel";
export const biasClass = "modulo";

export function uintsNeeded() {
  return 1;
}

export function resolve(uints, params, paytable, opts = {}) {
  const betMinor = opts.betMinor ?? 100000000;
  const { segments, risk } = params;
  const variant = paytable.variants[`${risk}/${segments}`];
  if (!variant) throw new Error(`wheel: no variant for ${risk}/${segments}`);
  const arranged = variant.arranged; // baked e8 table, length === segments

  const slot = uints[0] % segments;
  const multiplierE8 = arranged[slot];
  const win = multiplierE8 > 0;
  const payout = payoutMinor(betMinor, multiplierE8); // 0 on a zero wedge

  return {
    multiplierE8,
    win,
    payoutMinor: payout,
    outcome: { segments, risk, slot, table_e8: arranged, multiplier_e8: multiplierE8 },
  };
}
