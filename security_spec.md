# ROOMIE Firestore Security Specification

## 1. Data Invariants
1. **PII Isolation**: Private contact info (`email`, `phone`) lives strictly in `/users_private/{userId}` and is readable/writable ONLY by `request.auth.uid == userId`. `/profiles/{userId}` contains zero PII.
2. **Real Verified Identity**: All reads and writes require `request.auth != null && request.auth.token.email_verified == true`.
3. **Immutable Ownership & Timestamps**: `uid`, `createdAt`, `userA`, `userB`, `matchId`, and `senderUid` cannot be altered after creation. All timestamps must equal `request.time`.
4. **Master Gate Chat Isolation**: Messages under `/matches/{matchId}/messages/{messageId}` fetch the parent `/matches/{matchId}` document via `get()` and permit access ONLY to `userA` or `userB` while `status == 'active'`.
5. **Bounded Discovery Listing**: `/profiles` list queries are strictly gated on `resource.data.isActive == true` so deactivated profiles are never exposed.

## 2. "Dirty Dozen" Adversarial Payloads
1. Unauthenticated read on `/profiles/user_1` -> **DENIED**
2. Unverified email (`email_verified: false`) create on `/profiles/user_1` -> **DENIED**
3. Cross-user PII read on `/users_private/user_2` by `user_1` -> **DENIED**
4. Identity spoofing: `user_1` creating `/profiles/user_1` with `uid: "user_2"` -> **DENIED**
5. Shadow field injection: adding `isVerified: true` or `role: "admin"` to `/profiles/user_1` -> **DENIED**
6. ID poisoning: creating `/profiles/bad$id/..` with invalid regex characters -> **DENIED**
7. Unbounded array/string DoS: sending 25 skills or 1MB `bio` in `/profiles/user_1` -> **DENIED**
8. Timestamp forgery: sending past `createdAt` instead of `request.time` -> **DENIED**
9. Orphaned swipe: creating `/swipes/user_1_ghost` targeting non-existent `/profiles/ghost` -> **DENIED**
10. Cross-user match tampering: `user_3` reading or updating `/matches/user_1_user_2` -> **DENIED**
11. Archived match message injection: sending a message into `/matches/{matchId}/messages/{msgId}` when `status == 'archived'` -> **DENIED**
12. Owner mutation bypass: attempting to change `createdAt` or `uid` during `/profiles/{userId}` update -> **DENIED**
