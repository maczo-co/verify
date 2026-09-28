// originals-hive — pure resolver. Mirrors libs/game_math/hive.py.
//
// Nine uint32 words hatch a 3×3 comb: cell i takes colour `u_i mod C`, where C (2..5) is the colour
// count of the chosen difficulty. A flood fill over the board's 12 published undirected edges finds the
// largest orthogonally-connected same-colour swarm; its SIZE (1..9) indexes that difficulty's payout
// ladder. The ladder is an exact-rational rescale of a frozen shape against the exact largest-cluster
// size distribution — computed once in Python and BAKED into paytable.json, so this file only indexes
// it and applies the single integer payout floor.
//
// SPDX-License-Identifier: MIT
import { payoutMinor } from "@maczo/originals-verify";

export const game = "hive";
export const biasClass = "modulo";

export function uintsNeeded() {
  return 9; // CELLS — one word per cell
}

// 4-neighbour adjacency from the published edge list, mirroring hive.ADJ: for cell i, first the far
// ends of the edges that START at i (in edge order), then the far ends of those that END at i.
function adjacency(cells, edges) {
  return Array.from({ length: cells }, (_, i) =>
    edges.filter((e) => e[0] === i).map((e) => e[1]).concat(edges.filter((e) => e[1] === i).map((e) => e[0])),
  );
}

// (size, cells-ascending) of the largest same-colour connected component. Mirrors
// hive.largest_cluster: ONE `seen` array shared across components, roots scanned 0..8, and a STRICT
// `>` so a tie keeps the component found FIRST (the one with the lowest-indexed root) — that
// tie-break is player-visible in `cluster`, so it has to match exactly.
function largestCluster(colours, adj) {
  const seen = new Array(colours.length).fill(false);
  let bestSize = 0;
  let bestCells = [];
  for (let i = 0; i < colours.length; i++) {
    if (seen[i]) continue;
    const col = colours[i];
    const stack = [i];
    const comp = [];
    seen[i] = true;
    while (stack.length) {
      const n = stack.pop();
      comp.push(n);
      for (const m of adj[n]) {
        if (!seen[m] && colours[m] === col) {
          seen[m] = true;
          stack.push(m);
        }
      }
    }
    if (comp.length > bestSize) {
      bestSize = comp.length;
      bestCells = comp;
    }
  }
  return [bestSize, bestCells.slice().sort((a, b) => a - b)];
}

export function resolve(uints, params, paytable, opts = {}) {
  const rtpE8 = BigInt(opts.rtpE8 ?? paytable.rtpE8 ?? 99000000);
  const betMinor = opts.betMinor ?? 100000000;
  const cells = paytable.cells; // 9
  const difficulty = params.difficulty;
  const cfg = paytable.difficulty[difficulty];
  if (!cfg) {
    throw new Error(`hive.difficulty must be one of ${Object.keys(paytable.difficulty).join("/")}`);
  }
  // `tableE8` is baked at the PUBLISHED rtp: the server floors the exact rational rescale ONCE, at
  // that rtp, so a baked rung cannot be re-scaled to another rtp without drifting off the server's
  // number. Refuse instead of paying a table that is not the one the round settled on.
  if (rtpE8 !== BigInt(paytable.rtpE8 ?? 99000000)) {
    throw new Error("hive: tableE8 is baked at paytable.rtpE8 — cannot resolve at another rtp");
  }

  const C = cfg.C;
  const colours = [];
  for (let i = 0; i < cells; i++) colours.push(uints[i] % C);
  const [size, cluster] = largestCluster(colours, adjacency(cells, paytable.edges));

  const multiplierE8 = cfg.tableE8[size - 1]; // ladder index = size − 1 (size 1..9)
  const win = multiplierE8 > 0; // the small-size rungs are baked 0 = a real loss
  const payout = payoutMinor(betMinor, multiplierE8); // BigInt floor; 0 on a losing rung

  return {
    multiplierE8,
    win,
    payoutMinor: payout,
    outcome: { difficulty, C, colours, size, cluster, multiplier_e8: multiplierE8 },
  };
}
