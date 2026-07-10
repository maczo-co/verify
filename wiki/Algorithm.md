# The Algorithm

Lucky Spin's outcome is fully deterministic: the same
`(serverSeed, clientSeed, nonce, weights)` always produces the same segment. Here is exactly what the
server computes — the verifier in this repo reproduces it byte-for-byte.

## 1. Commitment

Before your first spin, the site shows:

```
commitment = SHA-256(serverSeed)      // 64 hex chars, lowercase
```

The raw `serverSeed` stays secret while it is active. The commitment proves the seed already existed
and cannot be swapped later — any change would produce a different SHA-256.

## 2. Per-spin randomness

For each spin:

```
digest = HMAC-SHA256(key = serverSeed, message = "clientSeed:nonce:cursor")   // cursor starts at 0
```

- `serverSeed` is the HMAC **key** (UTF-8 bytes).
- `message` is the UTF-8 string `clientSeed` + `:` + `nonce` + `:` + `cursor`.
- The result is 32 bytes.

## 3. Unbiased mapping (rejection sampling)

The 32-byte digest is read as **four 8-byte big-endian unsigned integers** (`uint64`). To keep the odds
exactly as configured we reject the small biased tail:

```
total  = sum(weights)
limit  = 2^64 - (2^64 mod total)      // largest exact multiple of total
```

For each 8-byte word in order: if `word >= limit`, skip it (biased — would distort odds); otherwise it
is accepted. If all four words are skipped, increment `cursor` and re-HMAC (astronomically rare).

## 4. Segment selection

The accepted word is reduced and walked across the cumulative weights:

```
pick = acceptedWord mod total
acc  = 0
for i in 0..weights.length-1:
    acc += weights[i]
    if pick < acc: return i        // this is the winning segment index
```

`segmentIndex` indexes into the wheel's segment list (weight > 0 only, in prize-table order). The prize
shown is `segments[segmentIndex]`.

## 5. Reveal

When you **Rotate** the seed, the site permanently retires it and reveals the original `serverSeed`.
You can then check `SHA-256(serverSeed) == commitment` and re-run every past spin under that seed.

## Reference implementations (this repo)
- `verify.js` — Node.js (uses `crypto`), CLI + `--selftest`
- `index.html` — offline browser (Web Crypto `subtle.digest` / `subtle.sign`)
- `test-vectors.json` — known-answer cases both must reproduce

Both use `BigInt` for exact `uint64` arithmetic. See the server's `ProvablyFairWheel` for the canonical
source.
