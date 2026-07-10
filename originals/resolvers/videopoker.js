// originals-videopoker — pure resolver. Mirrors libs/game_math/videopoker.py (Jacks or Better, 9/6).
//
// A 52-card deck is shuffled from the seed; deal order[:5], hold some, draw replacements from order[5:];
// the final 5-card hand pays the fixed Jacks-or-Better paytable (RTP ~98.95%, emergent from strategy).
//
// SPDX-License-Identifier: MIT
import { shuffle, payoutMinor, E8 } from "@maczo/originals-verify";

export const game = "videopoker";
export const biasClass = "uniform";

const DECK = 52; // rank = id % 13 (0=2 … 12=A), suit = id // 13

export function uintsNeeded() {
  return DECK - 1; // shuffle(52) consumes 51 uints
}

function evaluate(cards) {
  const ranks = cards.map((c) => c[0]).sort((a, b) => a - b);
  const suits = cards.map((c) => c[1]);
  const rc = {};
  for (const [r] of cards) rc[r] = (rc[r] || 0) + 1;
  const counts = Object.values(rc).sort((a, b) => b - a);
  const flush = new Set(suits).size === 1;
  const uniq = [...new Set(ranks)].sort((a, b) => a - b);
  let straight = false;
  let highLow = null;
  if (uniq.length === 5) {
    if (uniq[4] - uniq[0] === 4) {
      straight = true;
      highLow = uniq[0];
    } else if (uniq[0] === 0 && uniq[1] === 1 && uniq[2] === 2 && uniq[3] === 3 && uniq[4] === 12) {
      straight = true; // A-2-3-4-5 wheel
      highLow = -1;
    }
  }
  if (straight && flush && highLow === 8) return "royal"; // 10-J-Q-K-A
  if (straight && flush) return "straight_flush";
  if (counts[0] === 4) return "quads";
  if (counts[0] === 3 && counts[1] === 2) return "full_house";
  if (flush) return "flush";
  if (straight) return "straight";
  if (counts[0] === 3) return "trips";
  if (counts[0] === 2 && counts[1] === 2) return "two_pair";
  if (counts[0] === 2) {
    const pairRank = Number(Object.keys(rc).find((r) => rc[r] === 2));
    if (pairRank >= 9) return "jacks"; // J, Q, K, A
  }
  return "none";
}

export function resolve(uints, params, paytable, opts = {}) {
  const betMinor = opts.betMinor ?? 100000000;
  const pay = paytable.payoutMultiplier; // { royal:800, straight_flush:60, ... }
  const holds = params.holds;

  const order = shuffle(DECK, uints.slice(0, DECK - 1));
  const handIds = order.slice(0, 5);
  let nxt = 5;
  const finalIds = [];
  for (let i = 0; i < 5; i++) {
    if (holds[i]) finalIds.push(handIds[i]);
    else finalIds.push(order[nxt++]);
  }
  const cards = finalIds.map((c) => [c % 13, Math.floor(c / 13)]);
  const category = evaluate(cards);
  const multiplierE8 = Number(BigInt(pay[category]) * E8);

  return {
    multiplierE8,
    win: multiplierE8 > Number(E8),
    payoutMinor: payoutMinor(betMinor, multiplierE8),
    outcome: {
      deal: handIds.map((c) => [c % 13, Math.floor(c / 13)]),
      final: cards,
      category,
      multiplier_e8: multiplierE8,
    },
  };
}
