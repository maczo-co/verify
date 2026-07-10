// originals-bars — pure resolver. Mirrors libs/game_math/bars.py.
//
// Pick 1–5 cells on a 5×6 (30-cell) board. The WHOLE board reveals: each of the 30 cells draws a
// multiplier tier from the difficulty deck (slot = u mod 1e6 → first tier whose cumulative weight
// exceeds it), but only the picked cells pay. The payout multiplier is the SUM of the picked cells.
// The per-cell tier faces already bake the edge (value = base·rtp/0.99 / K), so RTP stays exact.
//
// SPDX-License-Identifier: MIT
import { payoutMinor } from "@maczo/originals-verify";

export const game = "bars";
export const biasClass = "modulo";

export function uintsNeeded() {
  return 30; // GRID — one draw per cell (whole board reveals)
}

export function resolve(uints, params, paytable, opts = {}) {
  const betMinor = opts.betMinor ?? 100000000;
  const { difficulty } = params;
  const d = paytable.difficulty[difficulty];
  if (!d) throw new Error(`bars.difficulty must be one of ${Object.keys(paytable.difficulty)}`);

  const picks = params.picks.slice().sort((a, b) => a - b);
  const k = picks.length;
  const cum = d.cum;
  const tiersK = d.perPicks[String(k)];
  const slots = paytable.slots; // 1_000_000

  const boardE8 = new Array(30);
  for (let i = 0; i < 30; i++) {
    const slot = uints[i] % slots;
    let t = 0;
    while (t < cum.length && slot >= cum[t]) t += 1;
    boardE8[i] = tiersK[t].multiplierE8;
  }

  const cellsE8 = picks.map((p) => boardE8[p]);
  const multiplierE8 = cellsE8.reduce((a, b) => a + b, 0);
  const win = multiplierE8 > 0;
  const payout = payoutMinor(betMinor, multiplierE8);

  return {
    multiplierE8,
    win,
    payoutMinor: payout,
    outcome: {
      difficulty,
      picks,
      board_e8: boardE8,
      cells_e8: cellsE8,
      multiplier_e8: multiplierE8,
    },
  };
}
