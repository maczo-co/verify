// originals-ascend — pure resolver. Mirrors libs/game_math/ascend.py.
//
// One uint32 word per ATTEMPTED rung. The player's slider fixes that leap's win-count `c` out of
// DEN = 1000, and the rung lands iff `(u mod DEN) < c` — a short gap is a near-sure landing, a long gap
// a long shot. The climb stops at the first miss (a bust, and a 0-rung round, pay nothing), so a win
// means every chosen rung landed. The edge is applied ONCE to the whole fair product (the hilo
// identity): multiplier_e8 = floor(rtp_e8 · DEN^k / (c_1·…·c_k)) — a single BigInt floor, never a
// per-rung one, and the value can pass 2^63 (a 15-rung all-min climb is ~3.2e27).
//
// SPDX-License-Identifier: MIT
import { payoutMinor } from "@maczo/originals-verify";

export const game = "ascend";
export const biasClass = "modulo";

export function uintsNeeded() {
  // MAX_RUNGS. The engine draws only `counts.length` words, but the HMAC stream is a prefix stream, so
  // drawing the maximum and reading the first `counts.length` words is bit-identical.
  return 15;
}

export function resolve(uints, params, paytable, opts = {}) {
  const rtpE8 = BigInt(opts.rtpE8 ?? paytable.rtpE8 ?? 99000000);
  const betMinor = opts.betMinor ?? 100000000;
  const DEN = paytable.den; // 1000 — the leap denominator (win chance = c/DEN)
  const { cMin, cMax, maxRungs } = paytable;

  // An EMPTY counts list is legal: a round abandoned before its first leap settles as a loss.
  const counts = Array.from(params.counts ?? []);
  if (counts.length > maxRungs) throw new Error(`ascend.counts must be 0..${maxRungs} win-counts`);
  for (const c of counts) {
    if (!Number.isInteger(c) || c < cMin || c > cMax) {
      throw new Error(`ascend.counts entries must be ints in [${cMin}, ${cMax}]`);
    }
  }

  // Replay the leaps. The busting rung IS recorded; rungs never tried are not (nothing undrawn leaks).
  let reached = 0;
  let busted = false;
  const rungs = [];
  for (let i = 0; i < counts.length; i++) {
    const c = counts[i];
    const r = uints[i] % DEN;
    const landed = r < c;
    rungs.push({ c, r, landed });
    if (!landed) {
      busted = true;
      break;
    }
    reached += 1;
  }

  // Depth 0 is NOT a 1× refund: a bust and a 0-rung round both lose outright.
  const win = !busted && reached > 0;

  let multE8 = 0n;
  if (win) {
    let num = rtpE8;
    let den = 1n;
    for (let i = 0; i < reached; i++) {
      num *= BigInt(DEN); // rtp_e8 · DEN^k …
      den *= BigInt(counts[i]); // … / ∏ c_i
    }
    multE8 = num / den; // ONE floor, at the very end, over the exact integer ratio
  }
  // Floor the payout from the exact BigInt multiplier (converting first would lose digits past 2^53).
  const payout = win ? payoutMinor(betMinor, multE8) : 0;

  return {
    multiplierE8: Number(multE8),
    win,
    payoutMinor: payout,
    outcome: { counts, reached, busted, DEN, rungs },
  };
}
