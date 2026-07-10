// originals-crossroad — pure resolver. Mirrors libs/game_math/crossroad.py.
//
// Cross the Road: 20 slots (SLOTS) hide `deaths` death positions (by difficulty), placed by a
// seed-driven shuffle (death set = first `deaths` of shuffle(20), == derive_bomb_set). The board is the
// 20−deaths crossable lanes; each lane crossed draws the next slot WITHOUT replacement. Cash out between
// lanes. Fair multiplier for crossing k lanes = rtp · ∏_{i<k}(20−i)/(20−deaths−i).
//
// SPDX-License-Identifier: MIT
import { shuffle, payoutMinor } from "@maczo/originals-verify";

export const game = "crossroad";
export const biasClass = "uniform";

export function uintsNeeded() {
  return 19; // SLOTS - 1 — the words the shuffle consumes
}

export function resolve(uints, params, paytable, opts = {}) {
  const rtpE8 = BigInt(opts.rtpE8 ?? paytable.rtpE8 ?? 99000000);
  const betMinor = opts.betMinor ?? 100000000;
  const slots = paytable.slots; // 20
  const difficulty = params.difficulty;
  const deaths = paytable.difficulty[difficulty].deaths;
  const lanes = params.lanes;

  const deathSet = shuffle(slots, uints).slice(0, deaths).sort((a, b) => a - b);
  const deathLookup = new Set(deathSet);
  let crossed = 0;
  let busted = false;
  for (let i = 0; i < lanes; i++) {
    if (deathLookup.has(i)) {
      busted = true;
      break;
    }
    crossed++;
  }
  const win = !busted && crossed > 0;

  let multiplierE8 = 0;
  if (win) {
    let num = 1n;
    let den = 1n;
    for (let i = 0; i < crossed; i++) {
      num *= BigInt(slots - i);
      den *= BigInt(slots - deaths - i);
    }
    multiplierE8 = Number((rtpE8 * num) / den); // single floor at the end
  }
  const payout = win ? payoutMinor(betMinor, multiplierE8) : 0;
  return {
    multiplierE8,
    win,
    payoutMinor: payout,
    outcome: { difficulty, lanes, crossed, busted, death_set: deathSet },
  };
}
