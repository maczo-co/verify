// originals-andar-bahar — pure resolver. Mirrors libs/game_math/andar_bahar.py.
//
// One seed-shuffled 52-card deck (the shared Fisher-Yates over 51 uint32 words). order[0] is the Joker; the
// cards under it are dealt Andar, Bahar, Andar… until the first card of the Joker's RANK (card c = rank c % 13,
// suit c // 13). The bet settles on that deal count k (1..49): Andar wins odd k, Bahar even k, a range bet
// lo <= k <= hi. A winning bet pays floor(placements·rtp / ways[bet]) — the BAKED ways table (Σ C(51-k, 2)
// over the bet's winning k) replaces the combinatorics, and BigInt keeps the same truncation as Python's //.
//
// SPDX-License-Identifier: MIT
import { shuffle, payoutMinor } from "@maczo/originals-verify";

export const game = "andar-bahar";
export const biasClass = "uniform";

const DECK = 52;

export function uintsNeeded() {
  return DECK - 1; // == AndarBahar.floats_used: shuffle(52) consumes 51 uints
}

function wins(paytable, bet, k) {
  if (bet === "andar") return k % 2 === 1; // Andar gets deals 1, 3, 5, …
  if (bet === "bahar") return k % 2 === 0;
  const [lo, hi] = paytable.ranges[bet];
  return k >= lo && k <= hi;
}

export function resolve(uints, params, paytable, opts = {}) {
  const rtpE8 = BigInt(opts.rtpE8 ?? paytable.rtpE8 ?? 99000000);
  const betMinor = opts.betMinor ?? 100000000;
  const bet = params.bet;
  if (!paytable.bets.includes(bet)) throw new Error(`andar-bahar.bet must be one of ${paytable.bets.join(",")}`);

  const order = shuffle(DECK, uints.slice(0, DECK - 1));
  const joker = order[0], rank = joker % 13;
  let k = 0;
  for (let i = 1; i < DECK; i++) {
    if (order[i] % 13 === rank) { k = i; break; }
  }
  const cards = order.slice(1, k + 1);
  const win = wins(paytable, bet, k);
  const multiplierE8 = win ? Number((BigInt(paytable.placements) * rtpE8) / BigInt(paytable.ways[bet])) : 0;
  return {
    multiplierE8,
    win: multiplierE8 > 0,
    payoutMinor: win ? payoutMinor(betMinor, multiplierE8) : 0,
    outcome: { bet, joker, cards, count: k, winner: k % 2 ? "andar" : "bahar", multiplier_e8: multiplierE8 },
  };
}
