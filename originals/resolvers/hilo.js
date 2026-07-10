// originals-hilo — pure resolver. Mirrors libs/game_math/hilo.py.
//
// 13 ranks, ACE LOW (A=0 … K=12). One uint32 per dealt card: rank = u mod 13, suit = (u div 13) mod 4.
// Guess hi/lo/same per step; ties win on mid ranks, edge cards (A/K) use STRICT hi/lo plus "same".
// The edge is applied ONCE to the cumulative fair multiplier 13^k / ∏(win_counts).
//
// SPDX-License-Identifier: MIT
import { payoutMinor } from "@maczo/originals-verify";

export const game = "hilo";
export const biasClass = "modulo";

const RANKS = 13;

export function uintsNeeded(params) {
  const g = params.guesses || [];
  return params.start_card ? g.length : g.length + 1;
}

// One uint32 → a card {rank 0..12 (A low), suit 0..3}.
function cardsFrom(uints, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const u = uints[i];
    out.push({ rank: u % RANKS, suit: Math.floor(u / RANKS) % 4 });
  }
  return out;
}

// Ace: hi is STRICT (12); King: lo is STRICT (12); everywhere else ties win. "same" wins on 1 rank.
function winCount(direction, rank) {
  if (direction === "same") return 1;
  if (direction === "hi") return rank === 0 ? 12 : RANKS - rank;
  return rank === RANKS - 1 ? 12 : rank + 1;
}

function guessOk(direction, cur, nxt) {
  if (direction === "same") return nxt === cur;
  if (direction === "hi") return cur === 0 ? nxt > cur : nxt >= cur;
  return cur === RANKS - 1 ? nxt < cur : nxt <= cur;
}

export function resolve(uints, params, paytable, opts = {}) {
  const rtpE8 = BigInt(opts.rtpE8 ?? paytable.rtpE8 ?? 99000000);
  const betMinor = opts.betMinor ?? 100000000;
  const guesses = params.guesses;
  const start = params.start_card;

  const seq =
    start != null
      ? [{ rank: start[0], suit: start[1] }, ...cardsFrom(uints, guesses.length)]
      : cardsFrom(uints, guesses.length + 1);

  let cur = seq[0].rank;
  let prod = 1n;
  let streak = 0;
  let busted = false;
  for (let i = 0; i < guesses.length; i++) {
    const d = guesses[i];
    const nxt = seq[i + 1].rank;
    if (!guessOk(d, cur, nxt)) {
      busted = true;
      break;
    }
    prod *= BigInt(winCount(d, cur));
    cur = nxt;
    streak += 1;
  }

  const win = !busted && streak > 0;
  const multiplierE8 = win ? Number((rtpE8 * 13n ** BigInt(streak)) / prod) : 0;
  const payout = win ? payoutMinor(betMinor, multiplierE8) : 0;
  const revealed = win ? streak + 1 : streak + 2;

  return {
    multiplierE8,
    win,
    payoutMinor: payout,
    outcome: {
      guesses,
      reached: streak,
      busted,
      cards: seq.slice(0, revealed).map((c) => [c.rank, c.suit]),
    },
  };
}
