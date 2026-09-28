// originals-stack — pure resolver. Mirrors libs/game_math/stack.py.
//
// One uint32 word per PLAYED floor becomes a lane residue r = u mod D (D = 8 divides 2^32, so the
// reduction is exactly uniform). The block you leaned survives iff r sits in that side's landing
// window — the w residues baked into paytable.difficulty[d].windows[w] (left {0..w-1}, right
// {D-w..D-1}); a miss topples the tower and pays nothing. The window's dead-centre residue is a
// "perfect" and keeps the width; any other catch trims it to the baked nextEdge (min 1). The
// multiplier is ONE BigInt floor over the baked per-floor odds D/w: floor(rtp · ∏ stepNum / ∏ stepDen).
//
// SPDX-License-Identifier: MIT
import { payoutMinor } from "@maczo/originals-verify";

export const game = "stack";
export const biasClass = "modulo";

export function uintsNeeded() {
  return 12; // MAX_FLOORS — one word per floor; only the floors actually leaned are ever read
}

export function resolve(uints, params, paytable, opts = {}) {
  const rtpE8 = BigInt(opts.rtpE8 ?? paytable.rtpE8 ?? 99000000);
  const betMinor = opts.betMinor ?? 100000000;
  const difficulty = params.difficulty;
  const cfg = paytable.difficulty[difficulty];
  if (!cfg) throw new Error(`stack.difficulty must be one of ${Object.keys(paytable.difficulty)}`);
  const { D, w0 } = cfg;
  // An EMPTY lean list is legal: a round abandoned before its first floor settles as a loss, and it
  // must still re-derive as 0 floors / 0 payout.
  const sides = params.sides ?? [];
  if (!Array.isArray(sides) || sides.length > paytable.maxFloors) {
    throw new Error(`stack.sides must be 0..${paytable.maxFloors} of 'left'/'right'`);
  }

  let w = w0;
  let reached = 0;
  let busted = false;
  const floors = [];
  // The edge is applied ONCE to the fair product ∏(D/w_j): accumulate the baked numerator/denominator
  // and take a single floor at the end, exactly as stack.mult_e8 does.
  let num = rtpE8;
  let den = 1n;
  for (let i = 0; i < sides.length; i++) {
    const side = sides[i];
    const wnd = cfg.windows[String(w)];
    if (!wnd) throw new Error(`stack: no baked window for w=${w}`);
    const lane = wnd[side];
    if (!lane) throw new Error("stack.sides entries must be 'left' or 'right'");

    const r = uints[i] % D;
    const survived = lane.residues.includes(r);
    const perfect = survived && r === lane.perfect;
    floors.push({ side, r, w, survived, perfect });
    if (!survived) {
      busted = true;
      break; // the tower topples: the leans after it are never walked
    }
    num *= BigInt(wnd.stepNum); // = D
    den *= BigInt(wnd.stepDen); // = the window width AT this floor
    reached += 1;
    w = perfect ? w : wnd.nextEdge;
  }

  const win = !busted && reached > 0;
  const multE8 = win ? num / den : 0n; // the single, house-favourable floor
  // Payout keeps the BigInt (bet · multiplier can pass 2^63 at these depths); only the reported
  // multiplier is narrowed, at the display boundary.
  const payout = win ? payoutMinor(betMinor, multE8) : 0;
  return {
    multiplierE8: Number(multE8),
    win,
    payoutMinor: payout,
    outcome: { difficulty, sides, reached, busted, D, w0, floors },
  };
}
