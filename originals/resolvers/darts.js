// originals-darts — pure resolver. Mirrors libs/game_math/darts.py.
//
// Two uint32 words settle a throw: DISTANCE picks one of six always-paying radial regions (first
// threshold it falls under), ROTATION fixes the visual landing angle. Region multipliers are pre-baked
// e8 (do NOT recompute the Fraction scaling here). A "win" is a multiplier >= 1x.
//
// SPDX-License-Identifier: MIT
import { payoutMinor } from "@maczo/originals-verify";

const UINT32 = 4294967296n;
const E8 = 100000000n;

export const game = "darts";
export const biasClass = "modulo";

export function uintsNeeded() {
  return 2;
}

export function resolve(uints, params, paytable, opts = {}) {
  const betMinor = opts.betMinor ?? 100000000;
  const { difficulty } = params;
  const d = paytable.difficulty[difficulty];
  if (!d) throw new Error(`darts: no difficulty ${difficulty}`);
  const { tiers, thresholds } = d;

  const distanceU = uints[0];
  const rotationU = uints[1];

  let region = 0; // Python default before the loop-with-break (thresholds[last]=2^32 always hits)
  for (let i = 0; i < thresholds.length; i++) {
    if (distanceU < thresholds[i]) {
      region = i;
      break;
    }
  }
  const multiplierE8 = tiers[region].multiplierE8;
  const win = multiplierE8 >= 100000000;
  const payout = payoutMinor(betMinor, multiplierE8);

  return {
    multiplierE8,
    win,
    payoutMinor: payout,
    outcome: {
      difficulty,
      region,
      regions: tiers.length,
      distance_e8: Number((BigInt(distanceU) * E8) / UINT32),
      rotation_e8: Number((BigInt(rotationU) * E8) / UINT32),
      multiplier_e8: multiplierE8,
    },
  };
}
