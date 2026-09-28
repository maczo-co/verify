// originals-menagerie — pure resolver. Mirrors libs/game_math/menagerie.py.
//
// A coupon-collector climb over S distinct species (S = 4..8 by difficulty). Reveal `reveals` tiles:
// tile i shows species `uints[i] mod S`; every BRAND-NEW species climbs the ladder, the FIRST repeat of
// an already-collected species busts the round (payout 0). Cashing out with d distinct species pays the
// exact reciprocal of P(reach d) with the edge applied once — its two integer factors (fairNumer[d] over
// fairDenom) are BAKED by the server from the engine's factorial ladder, so the only arithmetic here is
// one BigInt floor: multiplierE8 = floor(rtpE8 * fairNumer[d] / fairDenom).
//
// SPDX-License-Identifier: MIT
import { payoutMinor } from "@maczo/originals-verify";

export const game = "menagerie";
export const biasClass = "modulo";

export function uintsNeeded() {
  return 8; // max(S) == the engine's floats_used — one uint per reveal, only the first `reveals` used
}

export function resolve(uints, params, paytable, opts = {}) {
  const rtpE8 = BigInt(opts.rtpE8 ?? paytable.rtpE8 ?? 99000000);
  const betMinor = opts.betMinor ?? 100000000;
  const difficulty = params.difficulty;
  const cfg = paytable.difficulty[difficulty];
  if (!cfg) throw new Error(`menagerie.difficulty must be one of ${Object.keys(paytable.difficulty)}`);
  const S = cfg.S;
  // 0 IS legal: a round abandoned before its first reveal settles as a 0-payout loss, and its stored
  // params must re-derive THAT round (mirrors menagerie.validate).
  const reveals = params.reveals;
  if (!Number.isInteger(reveals) || reveals < 0 || reveals > S) {
    throw new Error(`menagerie.reveals must be an int in [0, ${S}]`);
  }

  // Mirrors menagerie.walk: bust on the FIRST repeat; `species` keeps the busting tile.
  const seen = new Set();
  const species = [];
  let reached = 0;
  let busted = false;
  for (let i = 0; i < reveals; i++) {
    const sp = uints[i] % S;
    species.push(sp);
    if (seen.has(sp)) {
      busted = true;
      break;
    }
    seen.add(sp);
    reached += 1;
  }
  const win = !busted && reached > 0;

  // Ladder LOOKUP, not a re-derivation: fairNumer[d] = S^(d-1)*(S-d)! and fairDenom = (S-1)! come baked
  // from the authoritative Python, so the edge lands under the SAME single floor mult_e8() applies (and
  // a round settled at a different configured RTP still verifies). fairNumer[0] is null on purpose —
  // nothing is staked forward before the first reveal, and `win` already forces the multiplier to 0.
  const multiplierE8 = win
    ? Number((rtpE8 * BigInt(cfg.fairNumer[reached])) / BigInt(cfg.fairDenom))
    : 0;
  const payout = win ? payoutMinor(betMinor, multiplierE8) : 0;

  return {
    multiplierE8,
    win,
    payoutMinor: payout,
    outcome: { difficulty, S, reveals, reached, busted, species },
  };
}
