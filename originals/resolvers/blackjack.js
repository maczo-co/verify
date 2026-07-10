// originals-blackjack — pure resolver. Mirrors libs/game_math/blackjack.py.
//
// A seed-shuffled shoe deals the hand; hit/stand/double (optionally after an insurance decision, or a
// split); the dealer stands on 17. Fixed pays: lose 0, push 1×, win 2×, blackjack 2.5×; double ×2;
// insurance pays 2:1 (+1.5× base) on a dealer natural. RTP is emergent (~99.4% basic strategy).
//
// SPDX-License-Identifier: MIT
import { payoutMinor, E8 } from "@maczo/originals-verify";

export const game = "blackjack";
export const biasClass = "uniform";

const DECK = 24; // cards drawn from the seed (plenty for one hand)
const E8N = Number(E8);

export function uintsNeeded() {
  return DECK;
}

// rank 0..12 = A,2..9,10,J,Q,K ; A=11 (soft), 2-9 face, 10/J/Q/K = 10
const cval = (rank) => (rank === 0 ? 11 : rank <= 8 ? rank + 1 : 10);

function total(ranks) {
  let t = ranks.reduce((s, r) => s + cval(r), 0);
  let aces = ranks.filter((r) => r === 0).length;
  while (t > 21 && aces > 0) {
    t -= 10;
    aces -= 1;
  }
  return t;
}

const isBlackjack = (ranks) => ranks.length === 2 && total(ranks) === 21;
const isPair = (seq) => cval(seq[0]) === cval(seq[2]);

function splitInsurance(actions) {
  if (actions.length && (actions[0] === "insurance" || actions[0] === "noInsurance")) {
    return [actions[0] === "insurance", actions.slice(1)];
  }
  return [null, actions.slice()];
}

function play(seq, actions) {
  const player = [seq[0], seq[2]];
  const dealer = [seq[1], seq[3]];
  let idx = 4;
  const [insured, acts] = splitInsurance(actions.slice());
  const pbj = isBlackjack(player);
  const dbj = isBlackjack(dealer);
  let doubled = false;
  let outcome;
  if (pbj || dbj) {
    outcome = pbj && dbj ? "push" : pbj ? "blackjack" : "lose";
  } else {
    let busted = false;
    for (const a of acts) {
      if (a === "hit") {
        player.push(seq[idx++]);
        if (total(player) > 21) {
          busted = true;
          break;
        }
      } else if (a === "double") {
        doubled = true;
        player.push(seq[idx++]);
        busted = total(player) > 21;
        break;
      } else {
        break; // stand
      }
    }
    if (busted) {
      outcome = "lose";
    } else {
      while (total(dealer) < 17) dealer.push(seq[idx++]);
      const pt = total(player);
      const dt = total(dealer);
      outcome = dt > 21 || pt > dt ? "win" : pt === dt ? "push" : "lose";
    }
  }
  let mult = { lose: 0, push: E8N, win: 2 * E8N, blackjack: (5 * E8N) / 2 }[outcome];
  if (doubled) mult *= 2;
  if (insured && dbj) mult += (3 * E8N) / 2;
  return {
    player,
    dealer,
    player_total: total(player),
    dealer_total: total(dealer),
    outcome,
    multiplier_e8: mult,
    doubled,
    insured,
  };
}

function playSplit(seq, actionsA, actionsB) {
  const handA = [seq[0], seq[4]];
  const handB = [seq[2], seq[5]];
  const dealer = [seq[1], seq[3]];
  let idx = 6;
  const playHand = (hand, actions) => {
    let doubled = false;
    let busted = false;
    for (const a of actions) {
      if (a === "hit") {
        hand.push(seq[idx++]);
        if (total(hand) > 21) {
          busted = true;
          break;
        }
      } else if (a === "double") {
        doubled = true;
        hand.push(seq[idx++]);
        busted = total(hand) > 21;
        break;
      } else break;
    }
    return [doubled, busted];
  };
  const [da, ba] = playHand(handA, actionsA);
  const [db, bb] = playHand(handB, actionsB);
  if (!(ba && bb)) while (total(dealer) < 17) dealer.push(seq[idx++]);
  const dt = total(dealer);
  const settle = (hand, busted, doubled) => {
    let oc;
    if (busted) oc = "lose";
    else {
      const pt = total(hand);
      oc = dt > 21 || pt > dt ? "win" : pt === dt ? "push" : "lose";
    }
    const base = { lose: 0, push: E8N, win: 2 * E8N }[oc];
    return [oc, base * (doubled ? 2 : 1)];
  };
  const [ocA, mA] = settle(handA, ba, da);
  const [ocB, mB] = settle(handB, bb, db);
  return {
    split: true,
    hand_a: handA,
    hand_b: handB,
    dealer,
    hand_a_total: total(handA),
    hand_b_total: total(handB),
    dealer_total: dt,
    outcome_a: ocA,
    outcome_b: ocB,
    doubled_a: da,
    doubled_b: db,
    multiplier_e8: mA + mB,
  };
}

export function resolve(uints, params, paytable, opts = {}) {
  const betMinor = opts.betMinor ?? 100000000;
  const seq = uints.slice(0, DECK).map((u) => u % 13);

  if (params.split) {
    const d = playSplit(seq, (params.actions_a || []).slice(), (params.actions_b || []).slice());
    if (params.insurance !== undefined && params.insurance !== null) d.insured = params.insurance === "insurance";
    return {
      multiplierE8: d.multiplier_e8,
      win: d.multiplier_e8 > 2 * E8N,
      payoutMinor: payoutMinor(betMinor, d.multiplier_e8),
      outcome: d,
    };
  }
  const d = play(seq, (params.actions || []).slice());
  return {
    multiplierE8: d.multiplier_e8,
    win: d.multiplier_e8 > E8N,
    payoutMinor: payoutMinor(betMinor, d.multiplier_e8),
    outcome: d,
  };
}
