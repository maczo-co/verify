// originals-triad — pure resolver. Mirrors libs/game_math/triad.py.
//
// Three uint32 words become three dice (die = 1 + u mod 6) — one of 216 equally-likely ORDERED rolls.
// You settle ONE bet; four of them (triple/double/single/total) carry a `pick`. The win test is pure
// integer selection on the dice (sum band, face count, "all three equal"), and the odds come out of the
// BAKED winCount table — the resolver never walks the 216 rolls. A flat bet pays
// floor(216·rtp / winCount[bet][pick]); Single pays (matches+1) × the ALREADY-FLOORED base
// floor(216·rtp / singleWeight), the same order the server floors in.
//
// SPDX-License-Identifier: MIT
import { payoutMinor } from "@maczo/originals-verify";

export const game = "triad";
export const biasClass = "modulo";

export function uintsNeeded() {
  return 3; // == TriadDice.floats_used
}

// The baked table is also the validator: a pick outside the bet's range has no key.
function winCountOf(paytable, bet, pick) {
  const t = paytable.winCount[bet];
  if (t === undefined) throw new Error(`triad.bet must be one of ${paytable.bets.join(",")}`);
  if (typeof t === "number") return t; // pick-less bet (small / big / any_triple)
  const wc = t[String(pick)];
  if (wc === undefined) {
    const [lo, hi] = paytable.pickRange[bet];
    throw new Error(`triad.pick for ${bet} must be an int in [${lo}, ${hi}]`);
  }
  return wc;
}

function faceCount(dice, face) {
  let n = 0;
  for (const d of dice) if (d === face) n += 1;
  return n;
}

function wins(paytable, bet, pick, dice, sum) {
  const isTriple = dice[0] === dice[1] && dice[1] === dice[2];
  switch (bet) {
    case "small": {
      const [lo, hi] = paytable.smallRange;
      return sum >= lo && sum <= hi && !isTriple; // triples pay the triple bets, never the bands
    }
    case "big": {
      const [lo, hi] = paytable.bigRange;
      return sum >= lo && sum <= hi && !isTriple;
    }
    case "any_triple":
      return isTriple;
    case "triple":
      return isTriple && dice[0] === pick;
    case "double":
      return faceCount(dice, pick) >= 2; // three of a kind wins a double too
    case "total":
      return sum === pick;
    case "single":
      return faceCount(dice, pick) >= 1;
    default:
      throw new Error(`triad.bet unknown: ${bet}`);
  }
}

export function resolve(uints, params, paytable, opts = {}) {
  const rtpE8 = BigInt(opts.rtpE8 ?? paytable.rtpE8 ?? 99000000);
  const betMinor = opts.betMinor ?? 100000000;
  const rolls = BigInt(paytable.rolls); // 216
  const bet = params.bet;

  const needsPick = paytable.needsPick.includes(bet);
  const pick = needsPick ? params.pick : 0; // the server forces 0 for a pick-less bet
  if (needsPick && !Number.isInteger(pick)) {
    const [lo, hi] = paytable.pickRange[bet];
    throw new Error(`triad.pick for ${bet} must be an int in [${lo}, ${hi}]`);
  }
  const wc = winCountOf(paytable, bet, pick); // also range-checks `pick`

  const dice = [uints[0] % 6 + 1, uints[1] % 6 + 1, uints[2] % 6 + 1];
  const sum = dice[0] + dice[1] + dice[2];
  const win = wins(paytable, bet, pick, dice, sum);
  const matches = bet === "single" ? faceCount(dice, pick) : 0;

  let multiplierE8 = 0;
  if (win) {
    if (bet === "single") {
      // FLOOR FIRST, then scale by the tier — (matches+1)·floor(...) != floor((matches+1)·...).
      const base = (rolls * rtpE8) / BigInt(paytable.singleWeight);
      multiplierE8 = Number(BigInt(matches + 1) * base);
    } else {
      multiplierE8 = Number((rolls * rtpE8) / BigInt(wc)); // the one house-favourable floor
    }
  }
  const payout = win ? payoutMinor(betMinor, multiplierE8) : 0;
  return {
    multiplierE8,
    win,
    payoutMinor: payout,
    outcome: { bet, pick, dice, sum, matches, multiplier_e8: multiplierE8 },
  };
}
