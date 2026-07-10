// originals-dice — pure resolver. Mirrors libs/game_math/dice.py.
//
// One uint32 word becomes a roll in [0,10000) (0.00–99.99). You win if it is under (or over) your
// target. The fair multiplier bakes the edge: floor(10000 · rtp / winning_outcomes).
//
// SPDX-License-Identifier: MIT
import { payoutMinor } from "@maczo/originals-verify";

export const game = "dice";
export const biasClass = "modulo";

export function uintsNeeded() {
  return 1;
}

function winCount(direction, target, rollRange) {
  // under T: rolls {0..T-1} → count T ; over T: rolls {T+1..range-1} → count range-1-T
  return direction === "under" ? target : rollRange - 1 - target;
}

export function resolve(uints, params, paytable, opts = {}) {
  const rtpE8 = BigInt(opts.rtpE8 ?? paytable.rtpE8 ?? 99000000);
  const betMinor = opts.betMinor ?? 100000000;
  const rollRange = paytable.rollRange; // 10000
  const { direction, target } = params;
  if (direction !== "under" && direction !== "over") throw new Error("dice.direction must be under/over");

  const roll = uints[0] % rollRange;
  const win = direction === "under" ? roll < target : roll > target;
  const wc = winCount(direction, target, rollRange);

  const multiplierE8 = win ? Number((BigInt(rollRange) * rtpE8) / BigInt(wc)) : 0;
  const payout = win ? payoutMinor(betMinor, multiplierE8) : 0;
  return {
    multiplierE8,
    win,
    payoutMinor: payout,
    outcome: { roll, direction, target, win_count: wc },
  };
}
