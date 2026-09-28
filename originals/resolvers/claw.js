// originals-claw — pure resolver. Mirrors libs/game_math/claw.py.
//
// Two uint32 words settle a drop. u0 mod 1,000,000 walks the chosen machine's cumulative prize weights
// (parts-per-million) to one prize face; u1 mod 1,000,000 walks the fixed GRIP table the same way to a
// grip numerator f of 8 (f ∈ {0,2,4,6,8} — the flaky grip may let the prize slip). The multiplier is the
// single integer division `prize_e8 · f // 8`, lossless because every baked face is a multiple of 8.
// Prize faces are pre-baked e8 at the published RTP (do NOT recompute the Fraction rescale here).
//
// SPDX-License-Identifier: MIT
import { payoutMinor } from "@maczo/originals-verify";

export const game = "claw";
export const biasClass = "modulo";

export function uintsNeeded() {
  return 2; // u0 = prize, u1 = grip
}

// Engine `_pick`: the first tier whose cumulative weight exceeds the slot; falls through to the last
// tier (unreachable while the weights sum to ppm, mirrored anyway).
function pick(cum, slot) {
  for (let i = 0; i < cum.length; i++) {
    if (slot < cum[i]) return i;
  }
  return cum.length - 1;
}

export function resolve(uints, params, paytable, opts = {}) {
  const rtpE8 = BigInt(opts.rtpE8 ?? paytable.rtpE8 ?? 99000000);
  const betMinor = opts.betMinor ?? 100000000;
  // The prize faces are baked at ONE rtp (E[prize]·E[grip] == rtp); refuse rather than answer with
  // odds that did not settle the bet.
  if (paytable.rtpE8 !== undefined && rtpE8 !== BigInt(paytable.rtpE8)) {
    throw new Error(`claw: paytable is baked at rtpE8 ${paytable.rtpE8}, asked for ${rtpE8}`);
  }
  const ppm = paytable.ppm; // 1_000_000
  const gripDen = BigInt(paytable.gripDen ?? 8);
  const { risk } = params;
  const tier = paytable.risk[risk];
  if (!tier) throw new Error(`claw: no risk ${risk}`);

  const prizeE8 = tier.prizes[pick(tier.cum, uints[0] % ppm)].prizeE8;
  const gripNum = paytable.grip[pick(paytable.gripCum, uints[1] % ppm)].num;

  const multiplierE8 = Number((BigInt(prizeE8) * BigInt(gripNum)) / gripDen); // the engine's one floor
  const win = multiplierE8 > 0;
  const payout = payoutMinor(betMinor, multiplierE8); // 0 when the grip drops it / the face is 0

  return {
    multiplierE8,
    win,
    payoutMinor: payout,
    outcome: {
      risk,
      prize_e8: prizeE8,
      grip_num: gripNum,
      grip_den: Number(gripDen),
      multiplier_e8: multiplierE8,
    },
  };
}
