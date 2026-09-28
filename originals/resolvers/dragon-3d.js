// originals-dragon-3d — pure resolver. Mirrors libs/game_math/dragon_3d.py (the Dragon Tower math of
// libs/game_math/dragon.py under its own game code).
//
// Dragon Tower 3D: climb ROWS=9 rows. Each row is an independent seeded shuffle of `tiles` pedestals; the first
// `hazards` positions of the shuffled order hold the skulls, every other pedestal a jade dragon egg (safe). Pick
// one pedestal per row — an egg climbs and grows the multiplier, a skull busts. The edge is applied ONCE to the
// cumulative fair multiplier: floor(rtp · tiles^k / safe^k) after k safe rows. An EMPTY pick list is legal (a
// round abandoned before its first pick) and resolves to 0.
//
// SPDX-License-Identifier: MIT
import { shuffle, payoutMinor } from "@maczo/originals-verify";

export const game = "dragon-3d";
export const biasClass = "uniform";

const ROWS = 9;
const MAX_PER = 3; // tiles<=4 -> per = tiles-1 <= 3 (upper bound; the uint stream is a stable prefix)

function dims(params, paytable) {
  const d = typeof params.difficulty === "string" ? paytable.difficulty[params.difficulty] : undefined;
  if (!d) throw new Error(`dragon-3d.difficulty must be one of ${Object.keys(paytable.difficulty)}`);
  return { tiles: d.tiles, hazards: d.hazards, per: d.tiles - 1 };
}

// The same rules the engine's validate() enforces — a malformed round is an error, never a guessed outcome.
function checkPicks(picks, tiles) {
  if (!Array.isArray(picks) || picks.length > ROWS) throw new Error(`dragon-3d.picks must be 0..${ROWS} column choices`);
  for (const c of picks) {
    if (!Number.isInteger(c) || c < 0 || c >= tiles) throw new Error(`dragon-3d.picks entries must be ints in 0..${tiles - 1}`);
  }
}

// uintsNeeded only receives params (no paytable), so return the difficulty-independent upper bound.
// resolve() slices each row with the ACTUAL per, so drawing the max prefix is exact.
export function uintsNeeded() {
  return ROWS * MAX_PER;
}

export function resolve(uints, params, paytable, opts = {}) {
  const rtpE8 = BigInt(opts.rtpE8 ?? paytable.rtpE8 ?? 99000000);
  const betMinor = opts.betMinor ?? 100000000;
  const { tiles, hazards, per } = dims(params, paytable);
  const picks = params.picks;
  checkPicks(picks, tiles);

  // Skull columns for ALL 9 rows (built regardless of how far the walk climbs), sorted ascending.
  const layout = [];
  for (let r = 0; r < ROWS; r++) {
    const order = shuffle(tiles, uints.slice(r * per, (r + 1) * per));
    layout.push(order.slice(0, hazards).sort((a, b) => a - b));
  }

  let reached = 0;
  let busted = false;
  for (let r = 0; r < picks.length; r++) {
    if (layout[r].includes(picks[r])) {
      busted = true;
      break;
    }
    reached += 1;
  }
  const win = !busted && reached > 0;

  const k = BigInt(reached);
  const multiplierE8 = win ? Number((rtpE8 * BigInt(tiles) ** k) / BigInt(tiles - hazards) ** k) : 0;
  // at the published RTP the baked ladder must agree with the formula it was baked from
  if (win && rtpE8 === BigInt(paytable.rtpE8) && paytable.difficulty[params.difficulty].ladderE8 &&
      multiplierE8 !== paytable.difficulty[params.difficulty].ladderE8[reached]) {
    throw new Error(`dragon-3d: published ladderE8[${reached}] disagrees with the formula`);
  }
  const payout = win ? payoutMinor(betMinor, multiplierE8) : 0;

  return {
    multiplierE8,
    win,
    payoutMinor: payout,
    outcome: {
      difficulty: params.difficulty,
      picks,
      reached,
      busted,
      layout,
    },
  };
}
