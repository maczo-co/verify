// originals-roulette — pure resolver. Mirrors libs/game_math/roulette.py.
//
// European single-zero wheel: pocket = u mod 37, every pocket equally likely. Each bet's fair
// multiplier bakes the edge: floor(37 · rtp / |winning pockets|); "straight" wins on {number}.
// Supports a single bet ({bet,number?}) OR a felt of chips ({bets:[{bet,number?,stake_minor}, …]})
// settled per stake_minor against the one pocket.
//
// SPDX-License-Identifier: MIT
import { payoutMinor, E8 } from "@maczo/originals-verify";

export const game = "roulette";
export const biasClass = "modulo";

export function uintsNeeded() {
  return 1;
}

export function resolve(uints, params, paytable, opts = {}) {
  const rtpE8 = BigInt(opts.rtpE8 ?? paytable.rtpE8 ?? 99000000);
  const betMinor = opts.betMinor ?? 100000000;
  const POCKETS = paytable.pockets; // 37
  const winningSets = paytable.winningSets;
  const reds = new Set(paytable.reds);

  const color = (p) => (p === 0 ? "green" : reds.has(p) ? "red" : "black");
  const winsetSize = (b) => (b.bet === "straight" ? 1 : winningSets[b.bet].length);
  const multE8 = (b) => Number((BigInt(POCKETS) * rtpE8) / BigInt(winsetSize(b)));
  const winsetOf = (b) => (b.bet === "straight" ? [b.number] : winningSets[b.bet]);

  const pocket = uints[0] % POCKETS;

  if (params.bets) {
    // felt of many chips, one pocket
    let total = 0;
    let payout = 0;
    const breakdown = [];
    for (const b of params.bets) {
      total += b.stake_minor;
      const win = winsetOf(b).includes(pocket);
      const p = win ? payoutMinor(b.stake_minor, multE8(b)) : 0;
      payout += p;
      breakdown.push({
        bet: b.bet,
        number: b.number ?? null,
        stake_minor: b.stake_minor,
        win,
        payout_minor: p,
      });
    }
    const multiplierE8 = total ? Number((BigInt(payout) * E8) / BigInt(total)) : 0;
    return {
      multiplierE8,
      win: payout > 0,
      payoutMinor: payout,
      outcome: { pocket, color: color(pocket), bets: breakdown, total_stake_minor: total },
    };
  }

  // single bet (legacy)
  const win = winsetOf(params).includes(pocket);
  const mult = win ? multE8(params) : 0;
  const payout = win ? payoutMinor(betMinor, mult) : 0;
  return {
    multiplierE8: mult,
    win,
    payoutMinor: payout,
    outcome: { pocket, color: color(pocket), bet: params.bet, number: params.number ?? null },
  };
}
