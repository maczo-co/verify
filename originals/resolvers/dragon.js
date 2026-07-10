// originals-dragon — pure resolver. Mirrors libs/game_math/dragon.py.
//
// Dragon Tower: climb ROWS=9 rows. Each row is an independent seeded shuffle of `tiles` columns; the
// first `eggs` positions are eggs (bad). Pick one column per row — a safe column climbs and grows the
// multiplier, an egg busts. Edge is applied ONCE to the cumulative fair multiplier (tiles/safe)^k.
//
// SPDX-License-Identifier: MIT
import { shuffle, payoutMinor, E8 } from "@maczo/originals-verify";

export const game = "dragon";
export const biasClass = "uniform";

const ROWS = 9;
const MAX_PER = 3; // tiles<=4 -> per = tiles-1 <= 3 (upper bound; the uint stream is a stable prefix)

function dims(params, paytable) {
  const d = paytable.difficulty[params.difficulty];
  if (!d) throw new Error(`dragon.difficulty must be one of ${Object.keys(paytable.difficulty)}`);
  return { tiles: d.tiles, eggs: d.eggs, per: d.tiles - 1 };
}

// uintsNeeded only receives params (no paytable), so return the difficulty-independent upper bound.
// resolve() slices each row with the ACTUAL per, so drawing the max prefix is exact.
export function uintsNeeded() {
  return ROWS * MAX_PER;
}

export function resolve(uints, params, paytable, opts = {}) {
  const rtpE8 = BigInt(opts.rtpE8 ?? paytable.rtpE8 ?? 99000000);
  const betMinor = opts.betMinor ?? 100000000;
  const { tiles, eggs, per } = dims(params, paytable);
  const picks = params.picks;

  // Egg columns for ALL 9 rows (built regardless of how far the walk climbs).
  const layout = [];
  for (let r = 0; r < ROWS; r++) {
    const order = shuffle(tiles, uints.slice(r * per, (r + 1) * per));
    layout.push(order.slice(0, eggs).sort((a, b) => a - b));
  }

  let streak = 0;
  let busted = false;
  for (let r = 0; r < picks.length; r++) {
    if (layout[r].includes(picks[r])) {
      busted = true;
      break;
    }
    streak += 1;
  }
  const win = !busted && streak > 0;

  const safe = tiles - eggs;
  const k = BigInt(streak);
  const multiplierE8 = win
    ? Number((rtpE8 * BigInt(tiles) ** k) / BigInt(safe) ** k)
    : 0;
  const payout = win ? payoutMinor(betMinor, multiplierE8) : 0;

  return {
    multiplierE8,
    win,
    payoutMinor: payout,
    outcome: {
      difficulty: params.difficulty,
      picks,
      reached: streak,
      busted,
      layout,
    },
  };
}
