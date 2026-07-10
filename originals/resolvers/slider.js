// originals-slider — pure resolver. Mirrors libs/game_math/slider.py.
//
// A pointer sweeps a strip of random multipliers and lands on one (a single uint32 draw); the player
// picks a target and wins target× if the landed multiplier >= target. Same fair model as Limbo:
// landed = rtp / (1 - u/2^32), so P(landed >= T) = rtp / T and RTP == rtp for any target.
//
// SPDX-License-Identifier: MIT
import { payoutMinor, E8 } from "@maczo/originals-verify";

export const game = "slider";
export const biasClass = "modulo";

const UINT32 = 4294967296n; // 2^32

// landed_e8 = floor(rtp·2^32 / (2^32 − u)) with u clamped to [1, 2^32−1], then clamped to [1.00×, cap].
function landedE8(u, rtpE8, maxMultE8) {
  let uu = BigInt(u);
  if (uu < 1n) uu = 1n;
  else if (uu > UINT32 - 1n) uu = UINT32 - 1n;
  let v = (rtpE8 * UINT32) / (UINT32 - uu);
  if (v < E8) v = E8;
  else if (v > maxMultE8) v = maxMultE8;
  return v; // BigInt
}

export function uintsNeeded() {
  return 1;
}

export function resolve(uints, params, paytable, opts = {}) {
  const rtpE8 = BigInt(opts.rtpE8 ?? paytable.rtpE8 ?? 99000000);
  const betMinor = opts.betMinor ?? 100000000;
  const maxMultE8 = BigInt(paytable.maxMultE8);
  const targetE8 = params.target_e8;

  const result = landedE8(uints[0], rtpE8, maxMultE8);
  const win = result >= BigInt(targetE8);
  const multiplierE8 = win ? targetE8 : 0;
  const payout = win ? payoutMinor(betMinor, targetE8) : 0;
  return {
    multiplierE8,
    win,
    payoutMinor: payout,
    outcome: { result_e8: Number(result), target_e8: targetE8 },
  };
}
