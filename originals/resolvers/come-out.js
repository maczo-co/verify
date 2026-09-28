// originals-come-out — pure resolver. Mirrors libs/game_math/come_out.py.
//
// Each throw is two real dice from the stream (die = 1 + u mod 6, 2 uints per throw) and throw 0 IS the
// come-out. Field / Any Seven / Any Craps settle on the come-out throw alone; Pass / Don't Pass settle
// the come-out and, only when a point is set, walk the SAME prefix-stable word stream from throw 1 for
// the point-vs-seven chase (up to nPairs throws). Every multiplier is READ from the baked `multsE8`
// table — the exact-rational odds live in Python. A push (Don't Pass come-out 12, or the unresolved tail
// after the cap) returns the stake at exactly 1e8 and is NOT a win: the engine's flag is mult > 1e8.
//
// SPDX-License-Identifier: MIT
import { payoutMinor, E8 } from "@maczo/originals-verify";

export const game = "come-out";
export const biasClass = "modulo";

const N_PAIRS = 64; // == come_out.N_PAIRS; the engine's floats_used is N_PAIRS * 2

export function uintsNeeded() {
  return N_PAIRS * 2; // the full cap is always drawn, so the come-out is a stable prefix of it
}

// Throw i as the two dice it actually is (port of _pair).
const pairAt = (uints, i) => [1 + (uints[2 * i] % 6), 1 + (uints[2 * i + 1] % 6)];

// Port of _play_line: play a Pass/Don't Pass line from the come-out pair. `rolls` are the throw SUMS and
// `dice` the real pips behind each of them, both including the come-out at index 0.
function playLine(uints, isDont, nPairs, points) {
  const p0 = pairAt(uints, 0);
  const s0 = p0[0] + p0[1];
  const d0 = [p0];
  if (isDont) {
    if (s0 === 2 || s0 === 3) return { result: "win", rolls: [s0], dice: d0 };
    if (s0 === 7 || s0 === 11) return { result: "lose", rolls: [s0], dice: d0 };
    if (s0 === 12) return { result: "push", rolls: [s0], dice: d0 }; // stake back, not a win
  } else {
    if (s0 === 7 || s0 === 11) return { result: "win", rolls: [s0], dice: d0 };
    if (s0 === 2 || s0 === 3 || s0 === 12) return { result: "lose", rolls: [s0], dice: d0 };
  }
  if (!points.has(s0)) throw new Error(`come-out: ${s0} is neither a natural/craps nor a point`);
  const point = s0;
  const dice = [];
  const sums = [];
  for (let i = 0; i < nPairs; i++) {
    const p = pairAt(uints, i);
    dice.push(p);
    sums.push(p[0] + p[1]);
  }
  for (let i = 1; i < sums.length; i++) {
    // i starts at 1: throw 0 is the come-out that SET the point, it never resolves the chase
    if (sums[i] === point) {
      return { result: isDont ? "lose" : "win", rolls: sums.slice(0, i + 1), dice: dice.slice(0, i + 1) };
    }
    if (sums[i] === 7) {
      return { result: isDont ? "win" : "lose", rolls: sums.slice(0, i + 1), dice: dice.slice(0, i + 1) };
    }
  }
  return { result: "unresolved", rolls: sums, dice }; // ~1e-12 tail — returns the stake
}

export function resolve(uints, params, paytable, opts = {}) {
  const rtpE8 = BigInt(opts.rtpE8 ?? paytable.rtpE8 ?? 99000000);
  const betMinor = opts.betMinor ?? 100000000;
  const nPairs = paytable.nPairs;
  const mults = paytable.multsE8;
  const points = new Set(paytable.points);
  const bet = params.bet;
  if (!paytable.bets.includes(bet)) throw new Error(`come-out.bet must be one of ${paytable.bets}`);
  if (nPairs !== N_PAIRS) throw new Error(`come-out: paytable nPairs=${nPairs} but this resolver draws ${N_PAIRS}`);
  if (rtpE8 !== BigInt(paytable.rtpE8)) {
    throw new Error(`come-out: multsE8 is baked at rtpE8=${paytable.rtpE8}; cannot settle at ${rtpE8}`);
  }

  const p0 = pairAt(uints, 0);
  const s0 = p0[0] + p0[1];
  const isLine = bet === "pass" || bet === "dont_pass";
  let multE8 = 0n;
  let result;
  let rolls = [s0];
  let dice = [p0]; // one-roll bets show only the come-out pips

  if (isLine) {
    const line = playLine(uints, bet === "dont_pass", nPairs, points);
    ({ result, rolls, dice } = line);
    if (result === "win") multE8 = BigInt(mults[bet]);
    else if (result === "push" || result === "unresolved") multE8 = E8;
  } else if (bet === "field") {
    const m = mults.field[String(s0)]; // a sum is in the table iff the field pays it
    result = m === undefined ? "lose" : "win";
    if (m !== undefined) multE8 = BigInt(m);
  } else if (bet === "any_seven") {
    result = s0 === 7 ? "win" : "lose";
    if (result === "win") multE8 = BigInt(mults.any_seven);
  } else {
    result = s0 === 2 || s0 === 3 || s0 === 12 ? "win" : "lose";
    if (result === "win") multE8 = BigInt(mults.any_craps);
  }

  const multiplierE8 = Number(multE8);
  return {
    multiplierE8,
    win: multE8 > E8, // a push is exactly 1e8 → stake back, win = false
    payoutMinor: payoutMinor(betMinor, multiplierE8),
    outcome: {
      bet,
      come_out: s0,
      point: isLine && points.has(s0) ? s0 : null, // only a line bet ever sets a point
      rolls,
      dice,
      result,
      multiplier_e8: multiplierE8,
    },
  };
}
