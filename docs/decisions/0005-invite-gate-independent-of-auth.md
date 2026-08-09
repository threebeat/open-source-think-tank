# ADR 0005 — Invite gate independent of authentication

- **Status:** Accepted for Phase 2 architecture (Work Package 2.2)
- **Date:** 2026-08-09
- **Context:** [phase-2-plan.md](../phase-2-plan.md), [0004-authjs-invite-only.md](./0004-authjs-invite-only.md)

## Context

Knowing a URL or obtaining a session must not open enrollment. Invite-only access has to survive auth bugs, stolen session cookies on non-invitees, and future provider swaps.

## Decision

1. Maintain a first-party **`invitations`** table (token hash, expiry, single-use, issuer, intended contact channel, status).
2. **Enrollment routes** require a valid, unexpired, unused invitation **before** account creation—checked in server code, not only in the UI.
3. **Authentication** may proceed only for:
   - an invitation acceptance flow bound to that token, or
   - an existing account created from a prior valid invitation.
4. A session without a corresponding account row in an allowed state (`pending_onboarding`, `active`, etc.) is rejected.
5. `pending_onboarding` sessions cannot access `active`-only capabilities (authorization matrix in 2.5).
6. Public-demo mode has no invitation API.

## Consequences

- Invite enforcement remains if Auth.js is replaced.
- Staff tooling is required to mint invitations (2.8).
- Token storage must hash secrets at rest; raw tokens appear only in email/links briefly.
