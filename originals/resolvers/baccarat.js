// originals-baccarat — pure resolver. Mirrors libs/game_math/baccarat.py.
//
// Cards are dealt from the seed (uniform ranks, value = rank+1 if rank≤8 else 0, from u mod 13) and
// the standard third-card rules pick the winner. Payouts use the known baccarat probabilities so each
// bet returns rtp: tie mult = rtp·pScale/P(tie); player/banker mult = (rtp·pScale − P(tie)·1e8)/P(side),
// push (stake back) on a tie. Single bet ({bet}) OR a felt of chips ({bets:[{bet,stake_minor}, …]}).
//
// SPDX-License-Identifier: MIT
import { payoutMinor, E8 } from "@maczo/originals-verify";

export const game = "baccarat";
export const biasClass = "modulo";

export function uintsNeeded() {
  return 6;
}

const value = (rank) => (rank <= 8 ? rank + 1 : 0);

// Port of _deal: standard baccarat third-card rules over the six drawn ranks.
function deal(uints) {
  const c = uints.slice(0, 6).map((u) => value(u % 13));
  const player = [c[0], c[1]];
  const banker = [c[2], c[3]];
  let pt = (c[0] + c[1]) % 10;
  let bt = (c[2] + c[3]) % 10;
  if (pt < 8 && bt < 8) {
    // no natural
    let p3 = null;
    if (pt <= 5) {
      p3 = c[4];
      player.push(p3);
    }
    // banker third-card rule
    let drawB = false;
    if (p3 === null) drawB = bt <= 5;
    else if (bt <= 2) drawB = true;
    else if (bt === 3) drawB = p3 !== 8;
    else if (bt === 4) drawB = p3 >= 2 && p3 <= 7;
    else if (bt === 5) drawB = p3 >= 4 && p3 <= 7;
    else if (bt === 6) drawB = p3 >= 6 && p3 <= 7;
    if (drawB) banker.push(c[5]);
  }
  pt = player.reduce((a, b) => a + b, 0) % 10;
  bt = banker.reduce((a, b) => a + b, 0) % 10;
  const winner = pt > bt ? "player" : bt > pt ? "banker" : "tie";
  return { player, banker, player_total: pt, banker_total: bt, winner };
}

export function resolve(uints, params, paytable, opts = {}) {
  const rtpE8 = BigInt(opts.rtpE8 ?? paytable.rtpE8 ?? 99000000);
  const betMinor = opts.betMinor ?? 100000000;
  const PROB = paytable.prob; // {banker, player, tie}
  const P_SCALE = BigInt(paytable.pScale); // 10000000

  const multE8 = (bet) => {
    if (bet === "tie") return Number((rtpE8 * P_SCALE) / BigInt(PROB.tie));
    return Number((rtpE8 * P_SCALE - BigInt(PROB.tie) * E8) / BigInt(PROB[bet]));
  };

  const settleOne = (bet, winner, stake) => {
    if (winner === bet) {
      const m = multE8(bet);
      return [payoutMinor(stake, m), m, "win"];
    }
    if (winner === "tie" && (bet === "player" || bet === "banker")) {
      return [stake, 100000000, "push"]; // 1x — stake returned, net zero
    }
    return [0, 0, "lose"];
  };

  const d = deal(uints);

  if (params.bets) {
    // felt of chips, one deal
    let total = 0;
    let payout = 0;
    const breakdown = [];
    for (const b of params.bets) {
      total += b.stake_minor;
      const [p, _m, res] = settleOne(b.bet, d.winner, b.stake_minor);
      payout += p;
      breakdown.push({
        bet: b.bet,
        stake_minor: b.stake_minor,
        win: res === "win",
        result: res,
        payout_minor: p,
      });
    }
    const multiplierE8 = total ? Number((BigInt(payout) * E8) / BigInt(total)) : 0;
    return {
      multiplierE8,
      win: payout > 0,
      payoutMinor: payout,
      outcome: { bets: breakdown, total_stake_minor: total, ...d },
    };
  }

  // single bet (legacy)
  const bet = params.bet;
  const [payout, mult, res] = settleOne(bet, d.winner, betMinor);
  return {
    multiplierE8: mult,
    win: res === "win",
    payoutMinor: payout,
    outcome: { bet, result: res, ...d },
  };
}
