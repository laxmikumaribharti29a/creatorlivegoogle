# Security Specification — CreatorLive24/7

## 1. Data Invariants
1. **Strict Ownership (`userId`)**: Every document in `/streamKeys/{keyId}` and `/streamSessions/{sessionId}` must have a `userId` matching `request.auth.uid` and `request.auth.token.email_verified == true`.
2. **Path Variable Guard (`isValidId`)**: All document IDs (`keyId`, `sessionId`) on single-document operations (`get`, `create`, `update`, `delete`) must satisfy `^[a-zA-Z0-9_\-]+$` and `.size() <= 128`.
3. **Immutable Ownership & Creation Time**: `userId` and `createdAt` can never be mutated during an `update`.
4. **Server Timestamps**: On `create`, `createdAt == request.time && updatedAt == request.time`. On `update`, `updatedAt == request.time`.
5. **Terminal State Locking**: Once a `StreamSession` reaches `status == 'stopped'`, no further updates are permitted.
6. **Query Enforcement (`allow list`)**: `allow list` on both collections strictly checks `resource.data.userId == request.auth.uid`.

## 2. The "Dirty Dozen" Payloads
1. **Identity Spoofing on StreamKey Create**: `{ userId: "victim_uid", platform: "youtube", ... }` -> `PERMISSION_DENIED`
2. **Unverified Email Write**: Authenticated user with `email_verified: false` creating a `StreamKey` -> `PERMISSION_DENIED`
3. **Shadow / Ghost Field Injection**: `{ ..., isAdmin: true }` on `StreamKey` create -> `PERMISSION_DENIED`
4. **Update-Gap Value Poisoning**: Updating `enabled` on `StreamKey` with string `"yes"` instead of boolean -> `PERMISSION_DENIED`
5. **Cross-User Read (`get`)**: User A reading User B's `/streamKeys/key_b` -> `PERMISSION_DENIED`
6. **Blanket List Scraping (`list`)**: Listing `/streamKeys` without filtering by `userId == request.auth.uid` -> `PERMISSION_DENIED`
7. **Owner Mutation on Update**: Changing `userId` during `/streamKeys/{keyId}` update -> `PERMISSION_DENIED`
8. **Forged Client Timestamp**: Setting `createdAt` to a past timestamp instead of `request.time` -> `PERMISSION_DENIED`
9. **Oversized Payload (Denial of Wallet)**: Setting `streamKey` to a 2000-character string (exceeding `maxLength: 512`) -> `PERMISSION_DENIED`
10. **Invalid Platform Enum**: Setting `platform` to `"tiktok"` (not in `["youtube", "facebook", "custom"]`) -> `PERMISSION_DENIED`
11. **Terminal State Re-opening**: Updating a `StreamSession` whose existing `status` is `'stopped'` back to `'live'` -> `PERMISSION_DENIED`
12. **ID Poisoning Attack**: Creating a document with an invalid ID containing spaces or special characters -> `PERMISSION_DENIED`
