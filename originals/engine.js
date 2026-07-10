// @maczo/originals-verify — the shared, frozen provably-fair engine for maczo Originals.
//
// This is a faithful, line-for-line port of the authoritative server recipe in
// libs/provably_fair/fair.py. It is the ONE place the HMAC→uint32 core lives; every per-game
// verifier repo (github.com/maczo-co/originals-<game>) and the shared verifier site
// (verify.maczo.co/originals/) import it. NEVER re-implement the crypto in a game repo.
//
//     key     = serverSeed (UTF-8 bytes)
//     message = `${clientSeed}:${nonce}:${cursor}`      (cursor = 0,1,2,… as more bytes are needed)
//     digest  = HMAC-SHA256(key, message)               (32 bytes)
//     uints   = digest consumed 4 bytes at a time, big-endian, as uint32 (u ∈ [0, 2^32))
//
// Discrete games settle by comparing the integer uints directly (never floats). `fairFloats`
// (u / 2^32 ∈ [0,1)) is a convenience for outcome *mapping* only.
//
// Runtime: uses the Web Crypto API (globalThis.crypto.subtle), which is present in Node >= 15 and
// every modern browser — so the SAME file runs the Node CLI self-test and the offline in-browser
// verifier with no branching. HMAC/digest are async there, so the seed-consuming calls are async.
//
// SPDX-License-Identifier: MIT

export const UINT32 = 4294967296; // 2 ** 32; floats are u / UINT32

// The client_seed charset is restricted so the message delimiter ':' can never be injected.
const CLIENT_SEED_RE = /^[A-Za-z0-9_-]{1,64}$/;
const _enc = new TextEncoder();

function _subtle() {
  const c = globalThis.crypto;
  if (!c || !c.subtle) {
    throw new Error(
      "Web Crypto (crypto.subtle) unavailable — need Node >= 15 or a secure browser context (https:// or file://).",
    );
  }
  return c.subtle;
}

export function validateClientSeed(clientSeed) {
  if (typeof clientSeed !== "string" || !CLIENT_SEED_RE.test(clientSeed)) {
    throw new Error("client_seed must match ^[A-Za-z0-9_-]{1,64}$");
  }
}

async function _hmacSha256(keyBytes, msgBytes) {
  const key = await _subtle().importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await _subtle().sign("HMAC", key, msgBytes)); // 32 bytes
}

// Return `count` uint32 words from the frozen HMAC stream. Each cursor yields 8 uints (32 bytes / 4);
// the cursor advances (and the HMAC re-runs) until `count` is satisfied. Mirrors fair.uint_stream.
export async function uintStream(serverSeed, clientSeed, nonce, count) {
  if (!Number.isInteger(count) || count < 0) throw new Error("count must be an int >= 0");
  if (!Number.isInteger(nonce) || nonce < 0) throw new Error("nonce must be an int >= 0");
  validateClientSeed(clientSeed);

  const keyBytes = _enc.encode(String(serverSeed));
  const out = [];
  let cursor = 0;
  while (out.length < count) {
    const digest = await _hmacSha256(keyBytes, _enc.encode(`${clientSeed}:${nonce}:${cursor}`));
    for (let i = 0; i < 32; i += 4) {
      // big-endian uint32; >>> 0 coerces the signed bit-or back to unsigned
      const u = ((digest[i] << 24) | (digest[i + 1] << 16) | (digest[i + 2] << 8) | digest[i + 3]) >>> 0;
      out.push(u);
      if (out.length >= count) break;
    }
    cursor += 1;
  }
  return out;
}

// Convenience: the uint stream mapped to floats in [0,1). Mapping only — never settle on these.
export async function fairFloats(serverSeed, clientSeed, nonce, count) {
  return (await uintStream(serverSeed, clientSeed, nonce, count)).map((u) => u / UINT32);
}

// Deterministic Fisher-Yates shuffle of range(n) driven by an ALREADY-DERIVED uint array (pure, sync).
// Requires >= n-1 uints. Each step picks j in [i, n) via modulo over the remaining range. Mirrors
// fair.shuffle — the modulo bias over a 2^32 range against a tiny remaining range is negligible.
export function shuffle(n, uints) {
  if (uints.length < Math.max(0, n - 1)) {
    throw new Error(`need >= ${n - 1} uints to shuffle ${n} items, got ${uints.length}`);
  }
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = 0; i < n - 1; i++) {
    const remaining = n - i;
    const j = i + (uints[i] % remaining);
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}

// Choose `mines` distinct positions from range(grid), sorted ascending. Mirrors fair.derive_bomb_set.
export async function deriveBombSet(grid, mines, serverSeed, clientSeed, nonce) {
  if (!(mines > 0 && mines < grid)) throw new Error("require 0 < mines < grid");
  const uints = await uintStream(serverSeed, clientSeed, nonce, grid - 1);
  const order = shuffle(grid, uints);
  return order.slice(0, mines).sort((a, b) => a - b);
}

// The public pre-commitment: SHA-256 hex (lowercase) of the server seed. Mirrors fair.commit.
export async function commit(serverSeed) {
  const d = new Uint8Array(await _subtle().digest("SHA-256", _enc.encode(String(serverSeed))));
  return Array.from(d, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Verify a revealed server seed against its earlier commitment. Mirrors fair.verify_commit.
export async function verifyCommit(serverSeed, commitmentHex) {
  return (await commit(serverSeed)) === String(commitmentHex).toLowerCase();
}

// ---- money mapping (integer minor units) ------------------------------------------------------------
export const E8 = 100000000n; // multipliers/RTP are integers scaled by 1e8

// The floor payout, in integer minor units: floor(bet * multiplier_e8 / 1e8). BigInt so a huge
// intermediate never loses precision. Mirrors money.payout_minor (flooring only ever lowers RTP).
export function payoutMinor(betMinor, multiplierE8) {
  const b = BigInt(betMinor);
  const m = BigInt(multiplierE8);
  if (b < 0n) throw new Error("betMinor must be >= 0");
  if (m < 0n) throw new Error("multiplierE8 must be >= 0");
  return Number((b * m) / E8);
}
