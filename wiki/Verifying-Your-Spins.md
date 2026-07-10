# Verifying Your Spins

You can verify any spin in three ways. All of them run **the same math the server used** — nothing is
trusted, everything is recomputed.

## What you need

From the Lucky Spin page (**🧾 Spin history & verify**), each spin shows:
- **Server Seed Hash** (commitment) — shown before the spin
- **Client Seed** — yours
- **Nonce** — the spin number
- **Server Seed** — appears only after you press **Rotate** (which reveals it)

To fully reproduce the *segment*, you also need the **weights** (segment odds). These are published in
[`weights.maczo.json`](https://github.com/maczo-co/lucky-spin/blob/main/weights.maczo.json) and are
embedded automatically in the site's **Verify ↗** links.

## Method 1 — One-click (easiest)

On maczo.co open **Lucky Spin → Spin history & verify**, press **Rotate seed** to reveal the server
seed, then click **Verify ↗** next to any spin. It opens
https://verify.maczo.co/ with everything filled in and computes instantly.

## Method 2 — Browser, manual

1. Open https://verify.maczo.co/ (or `index.html` from the repo — works fully offline).
2. Paste **Server Seed**, **Commitment**, **Client Seed**, **Nonce**, and the **weights** JSON.
3. Press **Verify spin**. You'll see:
   - ✅/❌ whether `SHA-256(serverSeed)` matches the commitment
   - the reproduced **segment index** and **prize**

## Method 3 — Node.js CLI

```bash
git clone https://github.com/maczo-co/lucky-spin
cd lucky-spin

# verify one spin
node verify.js \
  --commit  <serverSeedHash> \
  --server  <revealed serverSeed> \
  --client  <your clientSeed> \
  --nonce   <n> \
  --weights @weights.maczo.json

# confirm the code matches the spec with bundled known-answer vectors
node verify.js --selftest
```

## What "verified" proves

- **Commitment match** → the server committed to this exact seed *before* you played; it could not have
  been chosen after seeing your bet or client seed.
- **Reproduced segment** → the published result is exactly what the algorithm produces from the seeds
  and weights — not a number the operator picked.

If either check fails, the result was tampered with. (It won't — that's the point.)
