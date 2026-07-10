// originals-drill — pure resolver. Mirrors libs/game_math/drill.py.
//
// A 3-lane Limbo-family skin. The player sets a target multiplier and picks a shape/lane
// (diamond / circle / triangle). All three lanes draw a Limbo multiplier; the chosen lane must reach
// the target to win. P(lane >= target) = rtp/target and the payout is the target, so RTP == rtp.
//
// SPDX-License-Identifier: MIT
import { payoutMinor, E8 } from "@maczo/originals-verify";

export const game = "drill";
export const biasClass = "modulo";

const UINT32 = 4294967296n; // 2^32
const SHAPES = ["diamond", "circle", "triangle"];

// lane_e8 = floor(rtp·2^32 / (2^32 − u)) with u clamped to [1, 2^32−1], then clamped to [1.00×, cap].
function laneE8(u, rtpE8, maxMultE8) {
  let uu = BigInt(u);
  if (uu < 1n) uu = 1n;
  else if (uu > UINT32 - 1n) uu = UINT32 - 1n;
  let m = (rtpE8 * UINT32) / (UINT32 - uu);
  if (m < E8) m = E8;
  else if (m > maxMultE8) m = maxMultE8;
  return m; // BigInt
}

export function uintsNeeded() {
  return SHAPES.length; // one lane draw per shape
}

export function resolve(uints, params, paytable, opts = {}) {
  const rtpE8 = BigInt(opts.rtpE8 ?? paytable.rtpE8 ?? 99000000);
  const betMinor = opts.betMinor ?? 100000000;
  const maxMultE8 = BigInt(paytable.maxMultE8);
  const targetE8 = params.target_e8;
  const shape = params.shape;

  const lanes = SHAPES.map((_, i) => laneE8(uints[i], rtpE8, maxMultE8));
  const idx = SHAPES.indexOf(shape);
  const mine = lanes[idx];
  const win = mine >= BigInt(targetE8);
  const multiplierE8 = win ? targetE8 : 0;
  const payout = win ? payoutMinor(betMinor, targetE8) : 0;
  return {
    multiplierE8,
    win,
    payoutMinor: payout,
    outcome: {
      target_e8: targetE8,
      shape,
      lane: idx,
      lanes_e8: lanes.map(Number),
      mine_e8: Number(mine),
    },
  };
}
