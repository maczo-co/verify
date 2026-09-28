// originals-abyss-palace — pure resolver. Mirrors libs/game_math/abyss_palace.py.
//
// Abyss Palace: a plain Tower climb through 9 sunken-palace rows, one tile per row. Row r reads its own
// 3 words uints[3r..3r+2] (a fixed window for every difficulty — tiles-1 <= 3): the first tiles-1 drive a
// Fisher-Yates shuffle(tiles) whose first `traps` entries are the sharks. Walk the picks: a shark busts the
// round, a safe tile climbs one row. There is NO bonus tile (the summit treasure is scenery). The
// multiplier is read from the baked odds per safe-row count k (paytable.difficulty[d].odds[k]) as
// floor(rtp · num / den) = floor(rtp · tiles^k / safe^k) — one floor, like the engine.
//
// SPDX-License-Identifier: MIT
import { payoutMinor, shuffle } from "@maczo/originals-verify";

export const game = "abyss-palace";
export const biasClass = "uniform";

const ROWS = 9;
const WORDS = 3; // per row: the shuffle's tiles-1 <= 3 slots — difficulty-independent

export function uintsNeeded() {
  return ROWS * WORDS; // 27
}

export function resolve(uints, params, paytable, opts = {}) {
  const rtpE8 = BigInt(opts.rtpE8 ?? paytable.rtpE8 ?? 99000000);
  const betMinor = opts.betMinor ?? 100000000;
  const difficulty = params.difficulty;
  const tier = paytable.difficulty[difficulty];
  if (!tier) throw new Error(`abyss-palace: unknown difficulty ${difficulty}`);
  const { tiles, traps } = tier;
  const picks = Array.from(params.picks ?? []); // an EMPTY list is legal: a 0-pick abandoned round

  // the whole board (disclosed at round end): shark columns per row, sorted ascending
  const layout = [];
  for (let r = 0; r < ROWS; r++) {
    const w = uints.slice(r * WORDS, (r + 1) * WORDS);
    layout.push(shuffle(tiles, w.slice(0, tiles - 1)).slice(0, traps).sort((a, b) => a - b));
  }

  // walk the picks
  let reached = 0, busted = false;
  for (let r = 0; r < picks.length; r++) {
    if (layout[r].includes(picks[r])) { busted = true; break; }
    reached += 1;
  }
  const win = !busted && reached > 0;

  let multiplierE8 = 0;
  if (win) {
    const row = tier.odds[reached];
    if (!row) throw new Error(`abyss-palace: no published odds for depth ${reached}`);
    multiplierE8 = Number((rtpE8 * BigInt(row.num)) / BigInt(row.den));
    // at the published RTP the baked table must agree with the ratio it was baked from
    if (rtpE8 === BigInt(paytable.rtpE8) && multiplierE8 !== tier.ladderE8[reached]) {
      throw new Error(`abyss-palace: published ladderE8[${reached}] disagrees with odds`);
    }
  }
  const payout = win ? payoutMinor(betMinor, multiplierE8) : 0;

  return {
    multiplierE8,
    win,
    payoutMinor: payout,
    outcome: { difficulty, picks, reached, busted, layout },
  };
}
