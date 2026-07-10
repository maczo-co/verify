// originals-pump — pure resolver. Mirrors libs/game_math/pump.py.
//
// Pump: 25 slots (SLOTS) hide `pops` pop positions (by difficulty), placed by a seed-driven shuffle
// (pop set = first `pops` of shuffle(25), == derive_bomb_set). Each pump draws the next slot WITHOUT
// replacement; cash out between pumps. Fair multiplier for completing k pumps =
// rtp · ∏_{i<k}(25−i)/(25−pops−i) — Mines-family math with a fixed draw order.
//
// SPDX-License-Identifier: MIT
import { shuffle, payoutMinor } from "@maczo/originals-verify";

export const game = "pump";
export const biasClass = "uniform";

export function uintsNeeded() {
  return 24; // SLOTS - 1 — the words the shuffle consumes
}

export function resolve(uints, params, paytable, opts = {}) {
  const rtpE8 = BigInt(opts.rtpE8 ?? paytable.rtpE8 ?? 99000000);
  const betMinor = opts.betMinor ?? 100000000;
  const slots = paytable.slots; // 25
  const difficulty = params.difficulty;
  const pops = paytable.difficulty[difficulty].pops;
  const pumps = params.pumps;

  const popSet = shuffle(slots, uints).slice(0, pops).sort((a, b) => a - b);
  const popLookup = new Set(popSet);
  let completed = 0;
  let busted = false;
  for (let i = 0; i < pumps; i++) {
    if (popLookup.has(i)) {
      busted = true;
      break;
    }
    completed++;
  }
  const win = !busted && completed > 0;

  let multiplierE8 = 0;
  if (win) {
    let num = 1n;
    let den = 1n;
    for (let i = 0; i < completed; i++) {
      num *= BigInt(slots - i);
      den *= BigInt(slots - pops - i);
    }
    multiplierE8 = Number((rtpE8 * num) / den); // single floor at the end
  }
  const payout = win ? payoutMinor(betMinor, multiplierE8) : 0;
  return {
    multiplierE8,
    win,
    payoutMinor: payout,
    outcome: { difficulty, pumps, completed, busted, pop_set: popSet },
  };
}
