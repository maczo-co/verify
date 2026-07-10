// originals-coinflip — pure resolver. Mirrors libs/game_math/coinflip.py.
//
// One coin per uint32: flip_i = ["heads","tails"][u_i mod 2].
//  - PARLAY  {side, flips}   : win iff ALL `flips` coins match `side`; mult = rtp · 2^flips.
//  - STREAK  {guesses:[...]} : per-flip decisions, bust at the first mismatch; mult = rtp · 2^wins.
//    The terminal reveal carries the full MAX_FLIPS trail (proves quitting never changes the coins).
//
// SPDX-License-Identifier: MIT
import { payoutMinor } from "@maczo/originals-verify";

export const game = "coinflip";
export const biasClass = "modulo";

const SIDES = ["heads", "tails"];
const MAX_FLIPS = 20;

export function uintsNeeded() {
  return MAX_FLIPS;
}

export function resolve(uints, params, paytable, opts = {}) {
  const rtpE8 = BigInt(opts.rtpE8 ?? paytable.rtpE8 ?? 99000000);
  const betMinor = opts.betMinor ?? 100000000;

  if ("guesses" in params) {
    // STREAK: per-flip decisions, bust at the first wrong call.
    const guesses = params.guesses;
    const full = [];
    for (let i = 0; i < MAX_FLIPS; i++) full.push(SIDES[uints[i] % 2]);
    const results = [];
    let wins = 0;
    let busted = false;
    for (let i = 0; i < guesses.length; i++) {
      results.push(full[i]);
      if (full[i] === guesses[i]) {
        wins += 1;
      } else {
        busted = true;
        break;
      }
    }
    const win = !busted && wins >= 1;
    const multiplierE8 = win ? Number(2n ** BigInt(wins) * rtpE8) : 0;
    return {
      multiplierE8,
      win,
      payoutMinor: win ? payoutMinor(betMinor, multiplierE8) : 0,
      outcome: {
        streak: true,
        guesses: guesses.slice(0, results.length),
        results,
        wins,
        busted,
        trail: full,
      },
    };
  }

  // PARLAY: one pre-committed side over N coins.
  const side = params.side;
  const n = params.flips ?? 1;
  const results = [];
  for (let i = 0; i < n; i++) results.push(SIDES[uints[i] % 2]);
  const win = results.every((r) => r === side);
  const multiplierE8 = win ? Number(2n ** BigInt(n) * rtpE8) : 0;
  return {
    multiplierE8,
    win,
    payoutMinor: win ? payoutMinor(betMinor, multiplierE8) : 0,
    outcome: { result: results[0], results, side, flips: n },
  };
}
