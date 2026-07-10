// originals-snakes — pure resolver. Mirrors libs/game_math/snakes.py.
//
// A fixed 11-tile board maps 1:1 to the two-dice sums 2..12 (mirrored: sum s pays like 14−s). Each
// roll throws REAL 2d6 from the PF stream (die = 1 + u mod 6); landing on a multiplier tile multiplies
// the running total, landing on a snake sum busts. After the first successful roll the lowest tier
// upgrades for the rest of the round. Only the rolls actually made appear in the outcome.
//
// SPDX-License-Identifier: MIT
import { payoutMinor } from "@maczo/originals-verify";

export const game = "snakes";
export const biasClass = "modulo";

export function uintsNeeded() {
  return 10; // MAX_ROLLS * 2
}

export function resolve(uints, params, paytable, opts = {}) {
  const rtpE8 = BigInt(opts.rtpE8 ?? paytable.rtpE8 ?? 99000000);
  const betMinor = opts.betMinor ?? 100000000;
  const difficulty = params.difficulty;
  const rolls = params.rolls;
  const d = paytable.difficulty[difficulty];

  const snakes = new Set(d.snakes);
  const tiles = d.tiles; // keyed by sum string (2..7; s>7 mirrors 14−s)
  const lowest = d.lowest; // 2-elem array
  const upgrade = d.upgrade;

  // tile value (thousandths) at dice sum s, 0 for a snake. Mirrors snakes.tile_value_e3.
  const tileValueE3 = (s, upgraded) => {
    if (snakes.has(s)) return 0;
    if (upgraded && lowest.includes(s)) return upgrade;
    return tiles[String(s <= 7 ? s : 14 - s)];
  };

  const made = []; // dice pairs actually thrown
  const sums = [];
  const tiles_e3 = [];
  let prod = 1n;
  let upgraded = false;
  let busted = false;
  for (let i = 0; i < rolls; i++) {
    const d1 = 1 + (uints[2 * i] % 6);
    const d2 = 1 + (uints[2 * i + 1] % 6);
    const s = d1 + d2;
    made.push([d1, d2]);
    sums.push(s);
    const v = tileValueE3(s, upgraded);
    tiles_e3.push(v);
    if (v === 0) {
      busted = true;
      break;
    }
    prod *= BigInt(v);
    upgraded = true; // the lowest tier upgrades after the FIRST successful roll
  }

  const k = sums.length - (busted ? 1 : 0);
  const win = !busted && k > 0;
  // edge lives in the first-roll table (0.99 exactly); rtp rescales only non-default configs
  const multiplierE8 = win
    ? Number((rtpE8 * prod * 100000000n) / (99000000n * 1000n ** BigInt(k)))
    : 0;
  return {
    multiplierE8,
    win,
    payoutMinor: win ? payoutMinor(betMinor, multiplierE8) : 0,
    outcome: {
      difficulty,
      rolls,
      made: k,
      dice: made,
      sums,
      tiles_e3,
      busted,
      upgraded: upgraded && k > 0,
    },
  };
}
