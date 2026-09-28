// originals-shootout — pure resolver. Mirrors libs/game_math/shootout.py.
//
// One uint32 word per shot: only the FIRST `shots` words of the 7-word stream are read (7 = the
// engine's floats_used = max shot count). A shot is MADE iff u < threshold, where the baked
// threshold = pct·2^32 // 100 — a cut on the FULL uint32 range, so the make chance is EXACTLY
// threshold/2^32 and never pct/100. The make count then indexes the baked per-(range,shots) e8
// ladder; the exact-rational binomial rescale behind that ladder lives only in the server's Python,
// so this file never recomputes odds.
//
// SPDX-License-Identifier: MIT
import { payoutMinor } from "@maczo/originals-verify";

export const game = "shootout";
export const biasClass = "uniform";

export function uintsNeeded() {
  return 7; // == the engine's floats_used (max shot count); a 3-shot round reads only the first 3
}

export function resolve(uints, params, paytable, opts = {}) {
  const rtpE8 = BigInt(opts.rtpE8 ?? paytable.rtpE8 ?? 99000000);
  const betMinor = opts.betMinor ?? 100000000;
  // The ladders are baked at the paytable's RTP; settling against a different one would be a lie.
  if (paytable.rtpE8 !== undefined && rtpE8 !== BigInt(paytable.rtpE8)) {
    throw new Error(`shootout: paytable is baked at rtpE8=${paytable.rtpE8}, asked for ${rtpE8}`);
  }

  const shots = params.shots;
  const range = params.range;
  const tier = paytable.tiers[range];
  if (!tier) throw new Error(`shootout: no range ${range}`);
  const variant = paytable.variants[`${range}/${shots}`];
  if (!variant) throw new Error(`shootout: no variant ${range}/${shots}`);
  if (uints.length < shots) throw new Error(`shootout: need ${shots} uints, got ${uints.length}`);

  const threshold = tier.threshold; // integer, < 2^32: an exact comparison on unsigned uint32 words
  const shotsResult = [];
  let makes = 0;
  for (let i = 0; i < shots; i++) {
    const made = uints[i] < threshold;
    shotsResult.push(made);
    if (made) makes += 1;
  }

  const multiplierE8 = variant.ladder[makes]; // 0 below variant.floorMakes
  const win = multiplierE8 > 0;
  const payout = payoutMinor(betMinor, multiplierE8); // the engine's single BigInt floor

  return {
    multiplierE8,
    win,
    payoutMinor: payout,
    outcome: {
      shots,
      range,
      makes,
      shots_result: shotsResult,
      multiplier_e8: multiplierE8,
    },
  };
}
