// originals-threecard — pure resolver. Mirrors libs/game_math/threecard.py.
//
// Player and dealer each get 3 cards from one seed-shuffled deck. Player plays (2nd bet = ante) or
// folds; the dealer qualifies at Queen-high+; standard Ante/Play settlement plus an Ante bonus. RTP is
// emergent (~99.53%) from the fixed paytable under the Q-6-4 optimal strategy.
//
// SPDX-License-Identifier: MIT
import { shuffle, payoutMinor, E8 } from "@maczo/originals-verify";

export const game = "threecard";
export const biasClass = "uniform";

const DECK = 52;
const E8N = Number(E8);
// category ints (higher = better): high, pair, flush, straight, trips, straight_flush
const HIGH = 0, PAIR = 1, FLUSH = 2, STRAIGHT = 3, TRIPS = 4, STRAIGHT_FLUSH = 5;
const CAT_NAME = { 0: "high_card", 1: "pair", 2: "flush", 3: "straight", 4: "trips", 5: "straight_flush" };
const QUALIFY_KEY = [HIGH, 10]; // dealer qualifies at Queen-high (Q = rank 10) or better
const PLAY_KEY = [HIGH, 10, 4, 2]; // optimal: play Q-6-4 or better, else fold

export function uintsNeeded() {
  return DECK - 1; // shuffle(52) consumes 51 uints
}

const cards = (ids) => ids.map((c) => [c % 13, Math.floor(c / 13)]);

// Lexicographic tuple comparison (matches Python tuple ordering, incl. differing lengths).
function cmp(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return a.length - b.length;
}

function rank3(hand) {
  const ranks = hand.map((c) => c[0]).sort((a, b) => b - a); // desc
  const flush = new Set(hand.map((c) => c[1])).size === 1;
  const rc = {};
  for (const [r] of hand) rc[r] = (rc[r] || 0) + 1;
  const counts = Object.values(rc).sort((a, b) => b - a);
  const uniq = [...new Set(hand.map((c) => c[0]))].sort((a, b) => a - b);
  let straight = false;
  let straightHigh = null;
  if (uniq.length === 3) {
    if (uniq[2] - uniq[0] === 2) {
      straight = true;
      straightHigh = uniq[2];
    } else if (uniq[0] === 0 && uniq[1] === 1 && uniq[2] === 12) {
      straight = true; // A-2-3 wheel (A low), high card is the 3 (rank 1)
      straightHigh = 1;
    }
  }
  if (straight && flush) return [STRAIGHT_FLUSH, straightHigh];
  if (counts[0] === 3) return [TRIPS, ranks[0]];
  if (straight) return [STRAIGHT, straightHigh];
  if (flush) return [FLUSH, ...ranks];
  if (counts[0] === 2) {
    const pairRank = Math.max(...Object.keys(rc).filter((r) => rc[r] === 2).map(Number));
    const kicker = Math.min(...Object.keys(rc).filter((r) => rc[r] === 1).map(Number));
    return [PAIR, pairRank, kicker];
  }
  return [HIGH, ...ranks];
}

export function resolve(uints, params, paytable, opts = {}) {
  const betMinor = opts.betMinor ?? 100000000;
  const anteBonus = paytable.anteBonusE8; // keyed by category name
  const bonusFor = (catInt) => anteBonus[CAT_NAME[catInt]] || 0;

  const order = shuffle(DECK, uints.slice(0, DECK - 1));
  const player = cards(order.slice(0, 3));
  const dealer = cards(order.slice(3, 6));
  const pk = rank3(player);
  const dk = rank3(dealer);

  const played = "play" in params ? Boolean(params.play) : cmp(pk, PLAY_KEY) >= 0;
  const dealerQualifies = cmp(dk, QUALIFY_KEY) >= 0;
  const bonus = bonusFor(pk[0]);

  let returnE8, result;
  if (!played) {
    returnE8 = 0;
    result = "fold";
  } else if (!dealerQualifies) {
    returnE8 = 3 * E8N + bonus; // ante 1:1 (2 back), play pushes (1 back), + ante bonus
    result = "dealer_no_qualify";
  } else if (cmp(pk, dk) > 0) {
    returnE8 = 4 * E8N + bonus;
    result = "win";
  } else if (cmp(pk, dk) === 0) {
    returnE8 = 2 * E8N + bonus;
    result = "push";
  } else {
    returnE8 = bonus;
    result = "lose";
  }
  const anteBonusE8 = played ? bonus : 0;
  const staked = played ? 2 : 1;

  return {
    multiplierE8: returnE8,
    win: returnE8 > staked * E8N,
    payoutMinor: payoutMinor(betMinor, returnE8),
    outcome: {
      player,
      dealer,
      player_cat: CAT_NAME[pk[0]],
      dealer_cat: CAT_NAME[dk[0]],
      played,
      dealer_qualifies: dealerQualifies,
      return_e8: returnE8,
      staked_units: staked,
      result,
      ante_bonus_e8: anteBonusE8,
      multiplier_e8: returnE8,
    },
  };
}
