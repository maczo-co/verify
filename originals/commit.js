// @maczo/originals-verify — the commitment helper (SHA-256 of the server seed).
//
// The operator publishes commit(serverSeed) BEFORE any bet is placed on that seed; when the seed is
// later rotated it is revealed, and anyone can check verifyCommit(revealedSeed, publishedCommitment).
// Re-exported from engine.js so there is a single source of truth for the crypto.
//
// SPDX-License-Identifier: MIT

export { commit, verifyCommit } from "./engine.js";

// Alias matching the Lucky Spin verifier's `sha256Hex` name, for anyone porting from that repo.
export { commit as sha256Hex } from "./engine.js";
