// originals-limbo — pure resolver. Mirrors libs/game_math/limbo.py.
//
// A random crash multiplier is drawn from one uint32; the player picks a target and wins target× if
// crash >= target. The edge lives in the distribution: crash = rtp / (1 - u/2^32), so
// P(crash >= T) = rtp / T and RTP == rtp for any chosen target.
//
// SPDX-License-Identifier: MIT
import { payoutMinor, E8 } from "@maczo/originals-verify";

export const game = "limbo";
export const biasClass = "modulo";

const UINT32 = 4294967296n; // 2^32

// crash_e8 = floor(rtp·2^32 / (2^32 − u)) with u clamped to [1, 2^32−1], then clamped to [1.00×, cap].
function crashE8(u, rtpE8, maxMultE8) {
  let uu = BigInt(u);
  if (uu < 1n) uu = 1n;
  else if (uu > UINT32 - 1n) uu = UINT32 - 1n;
  let crash = (rtpE8 * UINT32) / (UINT32 - uu);
  if (crash < E8) crash = E8;
  else if (crash > maxMultE8) crash = maxMultE8;
  return crash; // BigInt
}

export function uintsNeeded() {
  return 1;
}

export function resolve(uints, params, paytable, opts = {}) {
  const rtpE8 = BigInt(opts.rtpE8 ?? paytable.rtpE8 ?? 99000000);
  const betMinor = opts.betMinor ?? 100000000;
  const maxMultE8 = BigInt(paytable.maxMultE8);
  const targetE8 = params.target_e8;

  const crash = crashE8(uints[0], rtpE8, maxMultE8);
  const win = crash >= BigInt(targetE8);
  const multiplierE8 = win ? targetE8 : 0;
  const payout = win ? payoutMinor(betMinor, targetE8) : 0;
  return {
    multiplierE8,
    win,
    payoutMinor: payout,
    outcome: { crash_e8: Number(crash), target_e8: targetE8 },
  };
}
