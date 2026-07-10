// originals-mines — pure resolver. Mirrors libs/game_math/mines.py.
//
// A 5x5 grid (GRID=25) hides `mines` bombs, placed by a seed-driven Fisher-Yates shuffle: the bomb set
// is the first `mines` positions of shuffle(25) (== Python derive_bomb_set). The player commits a set of
// tiles to reveal; you win iff none of them is a bomb. The fair multiplier for revealing k safe tiles is
// rtp · ∏_{i<k}(25−i)/(25−mines−i) — its inverse is exactly P(all k safe), so RTP = rtp.
//
// SPDX-License-Identifier: MIT
import { shuffle, payoutMinor } from "@maczo/originals-verify";

export const game = "mines";
export const biasClass = "uniform";

export function uintsNeeded() {
  return 24; // GRID - 1 — the words the shuffle consumes
}

export function resolve(uints, params, paytable, opts = {}) {
  const rtpE8 = BigInt(opts.rtpE8 ?? paytable.rtpE8 ?? 99000000);
  const betMinor = opts.betMinor ?? 100000000;
  const grid = paytable.grid; // 25
  const mines = params.mines;
  const picks = [...params.picks];
  const k = picks.length;

  // Bomb set: first `mines` of the seed-driven shuffle, sorted (== derive_bomb_set).
  const bombs = shuffle(grid, uints).slice(0, mines).sort((a, b) => a - b);
  const bombSet = new Set(bombs);
  const hit = [...new Set(picks)].filter((p) => bombSet.has(p)).sort((a, b) => a - b);
  const win = hit.length === 0;

  let multiplierE8 = 0;
  if (win) {
    let num = 1n;
    let den = 1n;
    for (let i = 0; i < k; i++) {
      num *= BigInt(grid - i);
      den *= BigInt(grid - mines - i);
    }
    multiplierE8 = Number((num * rtpE8) / den); // single floor at the end
  }
  const payout = win ? payoutMinor(betMinor, multiplierE8) : 0;
  return {
    multiplierE8,
    win,
    payoutMinor: payout,
    outcome: {
      mines,
      picks: picks.sort((a, b) => a - b),
      bomb_set: bombs,
      hit,
    },
  };
}
