// originals-moles — pure resolver. Mirrors libs/game_math/moles.py.
//
// Moles (whack-a-mole climb): HOLES=7 holes per row hide `moles` moles. Each row is an independent
// seeded shuffle of 7 holes; the first `moles` positions are moles. Pick one hole per row — you must
// HIT a mole to advance; an empty hole (a miss) busts. Rows are 8 at 1 mole, 9 at 2..6 moles. Edge is
// applied ONCE to the cumulative fair multiplier (7/moles)^k.
//
// SPDX-License-Identifier: MIT
import { shuffle, payoutMinor, E8 } from "@maczo/originals-verify";

export const game = "moles";
export const biasClass = "uniform";

const HOLES = 7;
const PER = HOLES - 1; // uints consumed per per-row shuffle

function rowsFor(moles) {
  return moles === 1 ? 8 : 9;
}

export function uintsNeeded(params) {
  return rowsFor(params.moles) * PER;
}

export function resolve(uints, params, paytable, opts = {}) {
  const rtpE8 = BigInt(opts.rtpE8 ?? paytable.rtpE8 ?? 99000000);
  const betMinor = opts.betMinor ?? 100000000;
  const moles = params.moles;
  const picks = params.picks;
  const rows = rowsFor(moles);

  // Mole hole-indices for ALL rows (built regardless of how far the walk climbs).
  const layout = [];
  for (let r = 0; r < rows; r++) {
    const order = shuffle(HOLES, uints.slice(r * PER, (r + 1) * PER));
    layout.push(order.slice(0, moles).sort((a, b) => a - b));
  }

  let streak = 0;
  let busted = false;
  for (let r = 0; r < picks.length; r++) {
    if (!layout[r].includes(picks[r])) {
      // empty hole -> miss -> round ends (inverse of Dragon's egg test)
      busted = true;
      break;
    }
    streak += 1; // whacked a mole -> climb
  }
  const win = !busted && streak > 0;

  const k = BigInt(streak);
  const multiplierE8 = win
    ? Number((rtpE8 * BigInt(HOLES) ** k) / BigInt(moles) ** k)
    : 0;
  const payout = win ? payoutMinor(betMinor, multiplierE8) : 0;

  return {
    multiplierE8,
    win,
    payoutMinor: payout,
    outcome: {
      moles,
      picks,
      reached: streak,
      busted,
      layout,
    },
  };
}
