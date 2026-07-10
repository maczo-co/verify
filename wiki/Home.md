# maczo Lucky Spin — Provably Fair

Welcome. This wiki explains, in full, how the **Lucky Spin** wheel on [maczo.co](https://maczo.co)
proves every result is fair — and how *you* can verify it yourself, with no need to trust us.

Lucky Spin uses a **commit-first** design: we lock in a secret **server seed** and publish its hash
*before* you spin, so we can't change the outcome after seeing your bet. Every result is a pure
function of three values you can inspect.

## Quick links
- 🧮 **[Verifying Your Spins](Verifying-Your-Spins)** — step-by-step, with the browser & CLI tools
- 🔐 **[The Algorithm](Algorithm)** — the exact HMAC-SHA256 formula + rejection sampling
- ❓ **[FAQ](FAQ)** — common questions

## The three inputs

| Value | Who controls it | When you see it |
| --- | --- | --- |
| **Server seed** | maczo (secret) | its **SHA-256 hash** is shown *before* you spin; the raw seed is revealed when you **Rotate** |
| **Client seed** | **you** (editable on the Lucky Spin page) | always |
| **Nonce** | server counter, +1 per spin | shown for each spin |

## Try the verifier now
- **Live (offline in your browser):** https://verify.maczo.co/
- **Source / Node CLI:** https://github.com/maczo-co/lucky-spin

Every **Verify ↗** link in your spin history on maczo.co opens the verifier pre-filled with that
spin's data and computes the result instantly.
