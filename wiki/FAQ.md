# FAQ

### What does "provably fair" actually mean here?
The wheel result is a pure cryptographic function of a **server seed** (which we commit to *before* you
spin), your **client seed**, and a **nonce**. Because the commitment is published first, we cannot change
the outcome afterward. You can recompute every result yourself — see [Verifying Your Spins](Verifying-Your-Spins).

### Why is the server seed hidden at first?
If we revealed it up front, the outcome of every future spin would be predictable. Instead we publish
`SHA-256(serverSeed)` (the commitment). When you **Rotate**, the raw seed is revealed so you can verify
the whole history — and the hash proves we never swapped it.

### Can maczo change where the wheel lands?
No. The server seed is fixed and its hash is published before you spin. Changing the seed would break
`SHA-256(serverSeed) == commitment`. The nonce is a server-owned counter that only ever increases, so
no result can be replayed.

### Do I have to trust maczo's website to verify?
No. The browser verifier (`index.html`) runs entirely offline — view source and confirm it makes no
network calls. Or run the Node CLI. Or re-implement the [algorithm](Algorithm) in any language.

### What are the "weights"?
They are the relative frequency of each wheel segment (the paytable). They are published in full in
`weights.maczo.json` and embedded in the site's verify links, so the exact segment can be reproduced.

### Why does the verifier need weights but the site hides some numbers?
It doesn't hide them — the prize values are printed on the wheel and the weights are published. You need
the weights only to map the random number to a segment; the cryptography above guarantees that mapping is
honest.

### The `cursor` in the formula is almost always 0 — why is it there?
It only advances in the extremely rare case that all four 8-byte words of one HMAC digest fall in the
biased tail and are rejected. It guarantees the sampling never runs out of randomness while staying
perfectly unbiased.

### My verification failed — what now?
Double-check you used the **revealed** server seed (after Rotate), the exact client seed and nonce shown
for that spin, and the published weights. If it still fails, contact support with the values — but the
math is deterministic, so a correct input always reproduces the published result.

### Is this the same method as Stake / BC.Game?
Yes — the same HMAC-SHA256 commit-reveal family, with rejection sampling to remove modulo bias. The
implementation is open source so anyone can audit it.
