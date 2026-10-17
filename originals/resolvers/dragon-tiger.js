// originals-dragon-tiger — pure resolver. Mirrors libs/game_math/dragon_tiger.py.
//
// Two uint32 words draw two cards from two full decks: Dragon = u0 mod 52, Tiger = u1 mod 52. Card c = rank c % 13
// (0=A … 12=K; value rank + 1, A low … K high), suit c // 13 (1 and 2 — ♥ ♦ — are red). The higher value wins; suits
// never decide. A bet that wins `ways` of the 2704 equally likely draws pays floor(2704·rtp / ways); Dragon / Tiger
// pay floor((2704·rtp − tieWays·halfE8) / ways) and hand back half (0.5x) on a tie. Tie = the same rank, Suited Tie =
// the very same card; a side bet reads its own side's card only. The BAKED win counts replace the enumeration, and
// BigInt keeps the same truncation as Python's //.
//
// SPDX-License-Identifier: MIT
import { payoutMinor } from "@maczo/originals-verify";

export const game = "dragon-tiger";
export const biasClass = "modulo";

const DECK = 52;

export function uintsNeeded() {
  return 2; // == DragonTiger.floats_used
}

const value = (c) => (c % 13) + 1;
const isRed = (c) => { const s = Math.floor(c / 13); return s === 1 || s === 2; };

function propHolds(prop, c) {
  const v = value(c);
  if (prop === "big") return v >= 8;
  if (prop === "small") return v <= 6;
  if (prop === "odd") return v % 2 === 1;
  if (prop === "even") return v % 2 === 0;
  return prop === "red" ? isRed(c) : !isRed(c);
}

export function resolve(uints, params, paytable, opts = {}) {
  const rtpE8 = BigInt(opts.rtpE8 ?? paytable.rtpE8 ?? 99000000);
  const betMinor = opts.betMinor ?? 100000000;
  const bet = params.bet;
  if (!paytable.bets.includes(bet)) throw new Error(`dragon-tiger.bet must be one of ${paytable.bets.join(",")}`);

  const dragon = uints[0] % DECK, tiger = uints[1] % DECK;   // exact: a uint32 is an exact double
  const vd = value(dragon), vt = value(tiger);
  const winner = vd > vt ? "dragon" : vt > vd ? "tiger" : "tie";
  const side = paytable.sides.includes(bet);
  let wins;
  if (side) wins = winner === bet;
  else if (bet === "tie") wins = winner === "tie";
  else if (bet === "suited_tie") wins = dragon === tiger;
  else {
    const i = bet.indexOf("_");
    wins = propHolds(bet.slice(i + 1), bet.slice(0, i) === "dragon" ? dragon : tiger);
  }
  const draws = BigInt(paytable.draws), ways = BigInt(paytable.ways[bet]);
  let m = 0n, result = "lose";
  if (wins) {
    m = side ? (draws * rtpE8 - BigInt(paytable.tieWays) * BigInt(paytable.halfE8)) / ways : (draws * rtpE8) / ways;
    result = "win";
  } else if (side && winner === "tie") {
    m = BigInt(paytable.halfE8); result = "half";
  }
  const multiplierE8 = Number(m);
  return {
    multiplierE8,
    win: result === "win",
    payoutMinor: payoutMinor(betMinor, multiplierE8),
    outcome: { bet, dragon, tiger, winner, suited: dragon === tiger, result, multiplier_e8: multiplierE8 },
  };
}
