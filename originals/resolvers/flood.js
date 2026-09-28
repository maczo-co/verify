// originals-flood — pure resolver. Mirrors libs/game_math/flood.py.
//
// A 4×4 basin. `shuffle(15, uints)` permutes INDICES into `others` — the 15 NON-START cells — and the
// first B of `others[perm[i]]` are rock (B from the chosen density), so the rock subset is uniform over
// C(15,B) and the start can never be rock. Water then floods the connected open region containing the
// (forced-open) start over the baked 4-neighbour adjacency; the flooded SIZE indexes the baked e8 ladder
// for (density, start-class). Those ladders are the engine's exact-rational rescale against the frozen
// size distribution, pre-baked at the published RTP — do NOT recompute them here.
//
// SPDX-License-Identifier: MIT
import { payoutMinor, shuffle } from "@maczo/originals-verify";

export const game = "flood";
export const biasClass = "uniform";

export function uintsNeeded() {
  return 15; // GRID - 1 === the engine's floats_used (the shuffle of the 15 non-start cells reads 14)
}

export function resolve(uints, params, paytable, opts = {}) {
  const rtpE8 = BigInt(opts.rtpE8 ?? paytable.rtpE8 ?? 99000000);
  const betMinor = opts.betMinor ?? 100000000;
  // Each ladder is rescaled so that E[multiplier] === rtp for that (density, class); a different rtp
  // would need a different rescale, so refuse rather than answer with odds that did not settle the bet.
  if (paytable.rtpE8 !== undefined && rtpE8 !== BigInt(paytable.rtpE8)) {
    throw new Error(`flood: paytable is baked at rtpE8 ${paytable.rtpE8}, asked for ${rtpE8}`);
  }
  const grid = paytable.gridSize; // 16

  const density = params.density;
  const dens = paytable.density[density];
  if (!dens) throw new Error(`flood.density must be one of ${Object.keys(paytable.density).join(", ")}`);
  const start = Number(params.start);
  if (!Number.isInteger(start) || start < 0 || start >= grid) {
    throw new Error(`flood.start must be an int in [0, ${grid - 1}]`);
  }

  // The rocks: a uniform subset of the 15 NON-START cells. `perm` indexes `others`, NOT the grid —
  // a plain shuffle(16) would be a different (and wrong) board.
  const others = [];
  for (let c = 0; c < grid; c++) if (c !== start) others.push(c);
  const perm = shuffle(others.length, uints);
  const rocks = [];
  for (let i = 0; i < dens.rocks; i++) rocks.push(others[perm[i]]);
  rocks.sort((a, b) => a - b);
  const blocked = new Set(rocks); // never contains `start`, so the start is open by construction

  // Flood the connected open region containing the start (DFS over the baked adjacency).
  const visited = new Set([start]);
  const stack = [start];
  const flooded = [];
  while (stack.length > 0) {
    const n = stack.pop();
    flooded.push(n);
    for (const m of paytable.adj[n]) {
      if (!visited.has(m) && !blocked.has(m)) {
        visited.add(m);
        stack.push(m);
      }
    }
  }
  flooded.sort((a, b) => a - b);
  const size = flooded.length;

  // Where the player clicked decides WHICH ladder: corner / center / edge (baked cell→class map).
  const cls = paytable.cellClass[start];
  const ladder = paytable.tables[`${density}/${cls}`];
  if (!ladder) throw new Error(`flood: no ladder for ${density}/${cls}`);
  const multiplierE8 = ladder[size - 1];

  const win = multiplierE8 > 0;
  const payout = payoutMinor(betMinor, multiplierE8); // the engine's single floor
  return {
    multiplierE8,
    win,
    payoutMinor: payout,
    outcome: { density, start, rocks, flooded, size, multiplier_e8: multiplierE8 },
  };
}
