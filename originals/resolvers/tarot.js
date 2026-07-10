// originals-tarot — pure resolver. Mirrors libs/game_math/tarot.py.
//
// The MIDDLE card is a Major Arcana (base multiplier, never 0x); LEFT and RIGHT are Minor Arcana that
// each multiply it (0x tiers bust). Tiers are drawn by CDF over the uint stream; the card-art ids are
// sampled separately (display only — they never move money). One BigInt floor bakes the edge.
//
// SPDX-License-Identifier: MIT
import { payoutMinor } from "@maczo/originals-verify";

export const game = "tarot";
export const biasClass = "modulo";

export function uintsNeeded() {
  return 6;
}

// Tier value via CDF over integer weights (u is a raw PF uint). Mirrors tarot._draw.
function draw(table, scale, u) {
  const x = u % scale;
  let acc = 0;
  for (const { valueE2, weight } of table) {
    acc += weight;
    if (x < acc) return valueE2;
  }
  return table[table.length - 1].valueE2; // unreachable (weights sum to scale) — guard
}

export function resolve(uints, params, paytable, opts = {}) {
  const rtpE8 = BigInt(opts.rtpE8 ?? paytable.rtpE8 ?? 99000000);
  const betMinor = opts.betMinor ?? 100000000;
  const difficulty = params.difficulty || "medium";
  const d = paytable.difficulty[difficulty];

  const middle = draw(d.major, paytable.majorScale, uints[0]); // Major Arcana — never 0x
  const left = draw(d.minor, paytable.minorScale, uints[1]);
  const right = draw(d.minor, paytable.minorScale, uints[2]);
  // card ART ids (display only): majors 1–22, minors 23–78
  const ids = {
    middle: 1 + (uints[3] % paytable.majorIds),
    left: 23 + (uints[4] % paytable.minorIds),
    right: 23 + (uints[5] % paytable.minorIds),
  };

  // final = rtp/0.99 · middle·left·right — ONE floor; 100^3 = 1000000, 99000000 is the fixed 0.99 denom
  const multiplierE8 = Number(
    (rtpE8 * BigInt(middle) * BigInt(left) * BigInt(right) * 100000000n) / (99000000n * 1000000n),
  );
  const bust = left === 0 || right === 0;
  const win = multiplierE8 > 0;
  return {
    multiplierE8,
    win,
    payoutMinor: payoutMinor(betMinor, multiplierE8),
    outcome: {
      difficulty,
      middle_e2: middle,
      left_e2: left,
      right_e2: right,
      ids,
      bust,
      multiplier_e8: multiplierE8,
    },
  };
}
