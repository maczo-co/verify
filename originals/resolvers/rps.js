// originals-rps — pure resolver. Mirrors libs/game_math/rps.py.
//
// house_i = ["rock","paper","scissors"][u_i mod 3]. Three param shapes:
//  - AUTO   {guesses:[...]} : pre-picked sequence in one call; ANY loss zeroes (all hands revealed),
//                             else mult = rtp · 2^wins (ties count ×1).
//  - LADDER {throws:[...]}  : climb per hand — WIN advances, TIE replays (push), LOSE busts;
//                             mult = rtp · 2^wins, cap at MAX_WINS.
//  - LEGACY {throw}         : single shot; win pays (3·rtp − 1)×, tie pushes 1.00×.
//
// SPDX-License-Identifier: MIT
import { payoutMinor, E8 } from "@maczo/originals-verify";

export const game = "rps";
export const biasClass = "modulo";

const THROWS = ["rock", "paper", "scissors"];
// index of the throw each key BEATS: rock>scissors, paper>rock, scissors>paper
const _BEATS = { 0: 2, 1: 0, 2: 1 };
const MAX_WINS = 20;

export function uintsNeeded(params) {
  if (params.guesses) return params.guesses.length;
  if (params.throws) return params.throws.length;
  if (params.throw !== undefined) return 1;
  return 64; // safety cap (MAX_THROWS)
}

export function resolve(uints, params, paytable, opts = {}) {
  const rtpE8 = BigInt(opts.rtpE8 ?? paytable.rtpE8 ?? 99000000);
  const betMinor = opts.betMinor ?? 100000000;

  // ---- AUTO: pre-picked guess sequence, ONE call (all house hands revealed) ----
  if (params.guesses) {
    const n = params.guesses.length;
    const house = [];
    for (let i = 0; i < n; i++) house.push(uints[i] % 3);
    const results = [];
    let wins = 0;
    let lost = false;
    for (let i = 0; i < n; i++) {
      const p = THROWS.indexOf(params.guesses[i]);
      const h = house[i];
      const r = p === h ? "tie" : _BEATS[p] === h ? "win" : "lose";
      results.push(r);
      if (r === "win") wins += 1;
      else if (r === "lose") lost = true; // keep looping: ALL hands are revealed regardless
    }
    const win = !lost;
    const multiplierE8 = win ? Number(rtpE8 * 2n ** BigInt(wins)) : 0;
    return {
      multiplierE8,
      win,
      payoutMinor: win ? payoutMinor(betMinor, multiplierE8) : 0,
      outcome: {
        guesses: params.guesses,
        house: house.map((h) => THROWS[h]),
        results,
        wins,
        busted: lost,
      },
    };
  }

  // ---- LEGACY single-shot ----
  if (params.throw !== undefined) {
    const house = uints[0] % 3;
    const player = THROWS.indexOf(params.throw);
    let result;
    let multiplierE8;
    if (player === house) {
      result = "tie";
      multiplierE8 = Number(E8);
    } else if (_BEATS[player] === house) {
      result = "win";
      multiplierE8 = Number(3n * rtpE8 - E8);
    } else {
      result = "lose";
      multiplierE8 = 0;
    }
    return {
      multiplierE8,
      win: result === "win",
      payoutMinor: payoutMinor(betMinor, multiplierE8),
      outcome: { throw: params.throw, house: THROWS[house], result },
    };
  }

  // ---- LADDER: WIN advances, TIE replays (push), LOSE busts ----
  const throws = params.throws;
  const house = [];
  for (let i = 0; i < throws.length; i++) house.push(uints[i] % 3);
  const results = [];
  let wins = 0;
  let busted = false;
  for (let i = 0; i < throws.length; i++) {
    if (wins >= MAX_WINS) break; // ladder top: terminal
    const p = THROWS.indexOf(throws[i]);
    const h = house[i];
    if (p === h) {
      results.push("tie"); // push: replay, no advance, no bust
    } else if (_BEATS[p] === h) {
      wins += 1;
      results.push("win");
    } else {
      results.push("lose");
      busted = true;
      break;
    }
  }
  const win = !busted && wins > 0;
  const multiplierE8 = win ? Number(rtpE8 * 2n ** BigInt(wins)) : 0;
  return {
    multiplierE8,
    win,
    payoutMinor: win ? payoutMinor(betMinor, multiplierE8) : 0,
    outcome: {
      throws,
      house: house.slice(0, results.length).map((h) => THROWS[h]),
      results,
      wins,
      busted,
    },
  };
}
