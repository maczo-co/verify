// originals-mythic-duel — pure resolver. Mirrors libs/game_math/mythic_duel.py.
//
// Mythic Duel: your 16-card deck (8 creatures x 2, paytable.deck) is shuffled by the first 15 words (the published
// Fisher-Yates); you hold the first 3. Turn t's rival card is word 15+t shifted right by 28 — a uniform index into his
// 16 cards (paytable.rival: 14 shadow creatures with a DEF, 2 traps = null). Each play is the hand SLOT that attacks:
// it HITS when the rival card is a creature whose DEF is below your card's ATK, and the hit spends the card and refills
// its slot with the next card of your deck; anything else destroys the attacker and ends the round. After k hits the
// multiplier is floor(rtp · 16^k / Π wins) — wins[card] = how many of his 16 cards that creature beats. 8 hits = K.O.
//
// SPDX-License-Identifier: MIT
import { shuffle, payoutMinor } from "@maczo/originals-verify";

export const game = "mythic-duel";
export const biasClass = "uniform";

export function uintsNeeded() {
  return 23; // 15 shuffle your deck + one per turn (8) for the rival's card
}

export function resolve(uints, params, paytable, opts = {}) {
  const rtpE8 = BigInt(opts.rtpE8 ?? paytable.rtpE8 ?? 99000000);
  const betMinor = opts.betMinor ?? 100000000;
  const n = paytable.deckSize, h = paytable.hand, maxHits = paytable.hits;
  const plays = params.plays.map(Number);

  const deck = shuffle(n, uints.slice(0, n - 1)).map((i) => paytable.deck[i]);
  const rival = [];
  for (let t = 0; t < maxHits; t++) rival.push(uints[n - 1 + t] >>> 28);

  const hand = deck.slice(0, h);
  let next = h;
  const wins = [];
  const turns = [];
  let busted = false;
  for (let t = 0; t < plays.length; t++) {
    const slot = plays[t], card = hand[slot], r = rival[t], foe = paytable.rival[r];
    const hit = foe !== null && foe.def < paytable.creatures[card].atk;
    turns.push({ slot, card, rival: r, hit });
    if (!hit) {
      busted = true;
      break;
    }
    wins.push(paytable.wins[card]);
    hand[slot] = deck[next++];
  }
  const k = wins.length;
  const win = !busted && k > 0;
  let multiplierE8 = 0;
  if (win) {
    let den = 1n;
    for (const w of wins) den *= BigInt(w);
    multiplierE8 = Number((rtpE8 * BigInt(n) ** BigInt(k)) / den); // single floor at the end
  }
  return {
    multiplierE8,
    win,
    payoutMinor: win ? payoutMinor(betMinor, multiplierE8) : 0,
    outcome: { plays, hits: k, busted, ko: k >= maxHits, hand, turns, deck, rival },
  };
}
