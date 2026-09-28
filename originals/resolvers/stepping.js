// originals-stepping — pure resolver. Mirrors libs/game_math/stepping.py.
//
// Stepping Stones: 15 stones hide D sinkers (by difficulty), placed by the seed-driven Fisher-Yates
// shuffle — the sinker set is the first D of shuffle(15) (== derive_bomb_set). You cross with leaps of
// 1, 2 or 3 stones: a leap of j reveals stones [reached..reached+j-1] all-or-nothing, so ONE sinker
// anywhere in it busts the round with no credit for the stones before it. The multiplier depends only
// on the total stones cleared k, read out of the baked odds ladder (paytable.difficulty[d].odds[k]) as
// floor(rtp · num / den) = rtp · C(15,D)/C(15-k,D) — a single floor, exactly as the engine applies it.
//
// SPDX-License-Identifier: MIT
import { payoutMinor, shuffle } from "@maczo/originals-verify";

export const game = "stepping";
export const biasClass = "uniform";

export function uintsNeeded() {
  return 14; // stones - 1 — the words derive_bomb_set's shuffle(15) consumes
}

export function resolve(uints, params, paytable, opts = {}) {
  const rtpE8 = BigInt(opts.rtpE8 ?? paytable.rtpE8 ?? 99000000);
  const betMinor = opts.betMinor ?? 100000000;
  const stones = paytable.stones; // 15
  const difficulty = params.difficulty;
  const tier = paytable.difficulty[difficulty];
  if (!tier) throw new Error(`stepping: unknown difficulty ${difficulty}`);
  const D = tier.D;
  const strides = Array.from(params.strides ?? []); // an EMPTY list is legal: a 0-leap abandoned round

  // the sinkers: first D of the seed-driven shuffle, sorted ascending (== Python's sorted(pit))
  const pitSet = shuffle(stones, uints).slice(0, D).sort((a, b) => a - b);
  const pit = new Set(pitSet);

  // walk: each leap of j is all-or-nothing over [reached..reached+j-1]
  let reached = 0;
  let busted = false;
  for (const j of strides) {
    let sank = false;
    for (let t = 0; t < j; t++) if (pit.has(reached + t)) sank = true;
    if (sank) {
      busted = true; // reached is NOT advanced — no partial credit inside a leap
      break;
    }
    reached += j;
  }
  const win = !busted && reached > 0;

  let multiplierE8 = 0;
  if (win) {
    // pure selection out of the published ladder + the ONE floor the engine applies
    const row = tier.odds[reached];
    if (!row) throw new Error(`stepping: no published odds for depth ${reached}`);
    multiplierE8 = Number((rtpE8 * BigInt(row.num)) / BigInt(row.den));
    // at the published RTP the baked ladder must agree with the ratio it was baked from
    if (rtpE8 === BigInt(paytable.rtpE8) && multiplierE8 !== tier.ladderE8[reached]) {
      throw new Error(`stepping: published ladderE8[${reached}] disagrees with odds[${reached}]`);
    }
  }
  const payout = win ? payoutMinor(betMinor, multiplierE8) : 0;

  return {
    multiplierE8,
    win,
    payoutMinor: payout,
    outcome: { difficulty, D, strides, reached, busted, pit_set: pitSet },
  };
}
