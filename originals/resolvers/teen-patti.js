// originals-teen-patti — pure resolver. Mirrors libs/game_math/teen_patti.py.
//
// One seed-shuffled 52-card deck (the shared Fisher-Yates over 51 uint32 words), dealt alternately: Player A gets
// order[0,2,4], Player B order[1,3,5]. Card c = rank c % 13 (0=A … 12=K), suit c // 13; aces high. The better Teen
// Patti hand wins — Trail > Pure Sequence > Sequence > Color > Pair > High Card, runs A-K-Q > A-2-3 > K-Q-J > … > 4-3-2,
// ranks high to low within a category, and suits never break a tie. Player A / B pay floor((rtp·total − tie·1e8) / win)
// and push (1x, the stake back) on a tie; Tie pays floor(rtp·total / tie); Pair Plus pays
// ppWeight[category]·floor(hands·rtp / ppWeightedHands) on its own player's hand. The BAKED counts (every hand and
// every tie, enumerated by the engine) replace the combinatorics, and BigInt keeps the same truncation as Python's //.
//
// SPDX-License-Identifier: MIT
import { shuffle, payoutMinor, E8 } from "@maczo/originals-verify";

export const game = "teen-patti";
export const biasClass = "uniform";

const DECK = 52;
const HIGH = 0, PAIR = 1, COLOR = 2, SEQUENCE = 3, PURE = 4, TRAIL = 5;

export function uintsNeeded() {
  return DECK - 1; // == TeenPatti.floats_used: shuffle(52) consumes 51 uints
}

const strength = (c) => ((c % 13) + 12) % 13; // aces high: 2 → 0 … K → 11, A → 12

// run order for 3 distinct strengths (high → low): A-K-Q 13 > A-2-3 12 > K-Q-J 11 > … > 4-3-2 2; 0 = no run
function runKey(a, b, c) {
  if (a - b === 1 && b - c === 1) return a === 12 ? 13 : a;
  return a === 12 && b === 1 && c === 0 ? 12 : 0;
}

// a comparable key: [category, tie-breakers…] — equal keys are an exact tie
export function handKey(cards) {
  const s = cards.map(strength).sort((x, y) => y - x);
  if (s[0] === s[2]) return [TRAIL, s[0]];
  const flush = new Set(cards.map((c) => Math.floor(c / 13))).size === 1;
  if (s[0] > s[1] && s[1] > s[2]) {
    const run = runKey(s[0], s[1], s[2]);
    if (run) return [flush ? PURE : SEQUENCE, run];
    return [flush ? COLOR : HIGH, ...s];
  }
  return [PAIR, s[1], s[0] === s[1] ? s[2] : s[0]]; // the middle strength is the paired one
}

function compare(x, y) { // lexicographic, like Python's tuple order
  for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] !== y[i]) return x[i] > y[i] ? 1 : -1;
  return x.length - y.length;
}

export function resolve(uints, params, paytable, opts = {}) {
  const rtpE8 = BigInt(opts.rtpE8 ?? paytable.rtpE8 ?? 99000000);
  const betMinor = opts.betMinor ?? 100000000;
  const bet = params.bet;
  if (!paytable.bets.includes(bet)) throw new Error(`teen-patti.bet must be one of ${paytable.bets.join(",")}`);

  const order = shuffle(DECK, uints.slice(0, DECK - 1));
  const a = [order[0], order[2], order[4]], b = [order[1], order[3], order[5]];
  const ka = handKey(a), kb = handKey(b), c = compare(ka, kb);
  const winner = c > 0 ? "a" : c < 0 ? "b" : "tie";
  const total = BigInt(paytable.total), tie = BigInt(paytable.tie), win = BigInt(paytable.win);
  let m = 0n, result = "lose";
  if (paytable.sides.includes(bet)) {
    if (winner === bet) { m = (rtpE8 * total - tie * E8) / win; result = "win"; }
    else if (winner === "tie") { m = E8; result = "push"; }
  } else if (bet === "tie") {
    if (winner === "tie") { m = (rtpE8 * total) / tie; result = "win"; }
  } else {
    const cat = paytable.categories[(paytable.pairPlus[bet] === "a" ? ka : kb)[0]];
    const w = BigInt(paytable.ppWeight[cat] ?? 0);
    if (w > 0n) { m = w * ((BigInt(paytable.hands) * rtpE8) / BigInt(paytable.ppWeightedHands)); result = "win"; }
  }
  const multiplierE8 = Number(m);
  return {
    multiplierE8,
    win: result === "win",
    payoutMinor: payoutMinor(betMinor, multiplierE8),
    outcome: { bet, a, b, hand_a: paytable.categories[ka[0]], hand_b: paytable.categories[kb[0]], winner, result,
               multiplier_e8: multiplierE8 },
  };
}
