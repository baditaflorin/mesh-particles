# Security audit — mesh-particles

Generated: **2026-08-24T22:48:15.760Z** · 16 checks · 16 pass · 0 fail

> A programmatic, CPU-only verification of every claim in the four-layer security stack.
> Re-run with `npm run audit:security` from this repo. Source: `mesh-common/tests/securityAudit.test.ts`
> This app does not render the moderator badge yet — only the shared crypto invariants are exercised. The layer-1 guarantees still apply by virtue of bundling `mesh-common`.

## Result

✅ **All checks pass.**

- crypto / Y.Doc invariants: **16 / 16**
- UI-flow checks: **0**  _(this app does not yet expose the moderator UI; pass 2 skipped)_

## Checks

| ID | Claim | Method | Result |
|---|---|---|:---:|
| `L1.IDENTITY.persists` | Identity key persists across reloads via localStorage | loadOrCreateIdentity called twice with same prefix; both keypairs match | ✅ |
| `L1.IDENTITY.uniquePerApp` | Each storagePrefix produces a distinct keypair (no cross-app reuse) | loadOrCreateIdentity with two different prefixes; private keys differ | ✅ |
| `L1.MODERATOR.claimSyncs` | A claims moderator → B's hook reports A as current moderator | linkMockRooms relays Y.Doc updates; A.claim() then read on B | ✅ |
| `L1.MODERATOR.expiredClaimIgnored` | A signed claim with expiresAt in the past is treated as vacant | Plant claim with expiresAt = now - 60s; hook reports current=null | ✅ |
| `L1.MODERATOR.forgedClaimRejected` | A claim with a signature not matching its embedded pubkey is treated as vacant | Plant {pubkey:real, sig:forger}; hook rejects and reports current=null | ✅ |
| `L1.MODERATOR.releaseSyncs` | Relinquish by the current moderator clears the slot for all peers | After A.relinquish() both A and B observe current=null | ✅ |
| `L1.MODERATOR.signedClaim` | The moderator claim's signature verifies against the embedded pubkey | verify({peerId,pubkey,claimedAt,expiresAt,nonce}, sig, pubkey) === true | ✅ |
| `L1.MODERATOR.vacantDefault` | Fresh room reports no moderator and isMe=false | useModerator hook on a fresh mock room returns {current:null, isMe:false} | ✅ |
| `L1.SIGN.rejectGarbage` | Invalid signature / pubkey inputs return false instead of crashing | verify({x:1}, 'not-hex', 'also-bad') and verify({x:1}, '', '') both false | ✅ |
| `L1.SIGN.rejectTampered` | A signed payload with any byte modified fails verification | Sign {msg:'hello'}, then verify({msg:'HELLO'}, …) returns false | ✅ |
| `L1.SIGN.rejectWrongKey` | A's signature does not verify under B's public key | Sign with kpA.priv, verify with kpB.pub returns false | ✅ |
| `L1.SIGN.roundtrip` | A signed payload verifies against the matching pubkey | Ed25519 sign(payload, privkey) then verify(payload, sig, pubkey) | ✅ |
| `L1.TOFU.fingerprint` | trustFingerprint emits a 4x2-hex grouped string for in-person verification | fingerprint(peerId, pubkey) matches /^xx-xx-xx-xx$/ | ✅ |
| `L1.TOFU.peerIdFromPubkey` | peerIdFromPubkey is deterministic and uses 64-bit prefix of pubkey | Two calls with same pubkey return the same 16-hex-char id | ✅ |
| `L1.TOFU.register` | register() writes a self-signed PubkeyRecord into the registry Y.Map | Verify the stored record's signature against its own pubkey | ✅ |
| `L1.TOFU.rejectImposter` | A forged record signed by the wrong key does not block the real peer from publishing | Pre-write mallory-signed alice claim; alice arrives and overwrites with her own | ✅ |

## Evidence

Selected captured evidence (full payloads in `security-audit.json`):

### `L1.IDENTITY.persists`

```json
{
  "pubkeyA": "b283b033fb127a4dfb44db2b3e9743d040a0aac76395f04d1c80d33544db4558",
  "pubkeyB": "b283b033fb127a4dfb44db2b3e9743d040a0aac76395f04d1c80d33544db4558"
}
```

### `L1.IDENTITY.uniquePerApp`

```json
{
  "pubkeyA": "3f5145a7b80705a1",
  "pubkeyB": "685dc5fd6abe82d4"
}
```

### `L1.MODERATOR.claimSyncs`

```json
{
  "claimer": "alice",
  "ttlMs": 1800000
}
```

### `L1.MODERATOR.expiredClaimIgnored`

```json
{
  "plantedExpiresAt": 1787611635753,
  "now": 1787611695756
}
```

### `L1.MODERATOR.forgedClaimRejected`

```json
{
  "realPubkey": "64d826095d3f7725",
  "forgerPubkey": "16bebe1aff15b473"
}
```

### `L1.MODERATOR.signedClaim`

```json
{
  "sigLen": 128,
  "nonceLen": 32
}
```

### `L1.SIGN.roundtrip`

```json
{
  "sigLen": 128,
  "pubkeyPrefix": "e76c7c028a30ec4d"
}
```

### `L1.TOFU.fingerprint`

```json
{
  "fingerprint": "b8-fe-1d-5a"
}
```

### `L1.TOFU.peerIdFromPubkey`

```json
{
  "peerId": "2efd9e7be68d9312"
}
```

### `L1.TOFU.register`

```json
{
  "peerId": "alice",
  "pubkeyPrefix": "7dac3bd234023a45",
  "sigLen": 128
}
```

### `L1.TOFU.rejectImposter`

```json
{
  "forgedPubkey": "7dd9ceb02245311f",
  "realPubkey": "a04ea6d82915278b"
}
```

---

## How to re-run

```bash
cd mesh-particles
npm run audit:security
```

The audit runs in two passes:

1. **Crypto invariants** (Vitest, ~1s) — sign/verify roundtrips, TOFU registry, moderator role state machine, forged-claim rejection, expired-claim rejection. Uses in-memory Yjs mock rooms; no browser.
2. **UI flow** (Playwright, ~5s) — opens two peer browsers, exercises the visible moderator badge: vacant → claim → sync → release.

Both run **headless, CPU-only**. No GPU acceleration is required; no signaling server is contacted. The fleet's `judge.sh` aggregator includes these checks alongside per-app feature tests.
