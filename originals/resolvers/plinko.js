// originals-plinko — pure resolver. Mirrors libs/game_math/plinko.py.
//
// A ball falls through `rows` pegs; each peg sends it left (0) or right (1) using one bit of the
// stream. The bucket index = number of right-steps = sum(path), in [0, rows]. Every bucket pays its
// baked multiplier (there is no separate win/loss branch): index into the reference table for
// `${risk}/${rows}`. `win` is just "did the bucket pay back break-even or better".
//
// SPDX-License-Identifier: MIT
import { payoutMinor } from "@maczo/originals-verify";

export const game = "plinko";
export const biasClass = "uniform";

export function uintsNeeded(params) {
  return params.rows;
}

export function resolve(uints, params, paytable, opts = {}) {
  const betMinor = opts.betMinor ?? 100000000;
  const { rows, risk } = params;

  const path = uints.slice(0, rows).map((u) => u & 1); // 1 = right
  const bucket = path.reduce((a, b) => a + b, 0);

  const variant = paytable.variants[`${risk}/${rows}`];
  if (!variant) throw new Error(`plinko: no variant ${risk}/${rows}`);
  const multiplierE8 = variant.buckets[bucket];

  const win = multiplierE8 >= 100000000; // >= break-even
  const payout = payoutMinor(betMinor, multiplierE8); // Plinko always pays the bucket multiplier

  return {
    multiplierE8,
    win,
    payoutMinor: payout,
    outcome: { rows, risk, path, bucket, multiplier_e8: multiplierE8 },
  };
}
