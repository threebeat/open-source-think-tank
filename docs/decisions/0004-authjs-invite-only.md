# ADR 0004 — Auth.js for invite-only sessions

- **Status:** Accepted for Phase 2 gated environments (Work Package 2.2)
- **Date:** 2026-08-09
- **Context:** [phase-2-plan.md](../phase-2-plan.md) §9 packages 2.4 / 2.8, [0002-environments-and-demo-isolation.md](./0002-environments-and-demo-isolation.md)

## Context

Gated Phase 2 needs sign-in, sign-out, session renewal, recovery, and invite acceptance without public self-registration. Authentication success must not imply institutional `active` status or statutory membership.

## Decision

1. Use **Auth.js (NextAuth v5)** on the Next.js server for session establishment in gated modes only.
2. Prefer **email magic-link / one-time token** sign-in for invitees; disable public credentials signup.
3. Wrap Auth.js behind **`AuthAdapter`**. Route handlers and server actions depend on the adapter, not Auth.js types leaking into domain code.
4. Deliver mail through **`EmailAdapter`**. Concrete vendor (Resend or Amazon SES) requires a short addendum ADR before production secrets are issued; local/dev may use Mailpit/Ethereal.
5. Account lifecycle states include `invited`, `pending_onboarding`, `active`, `suspended`, `closed`, `anonymization-pending`.
6. **2.4** may authenticate users into `pending_onboarding` only. Transition to **`active`** is performed only by **2.8** after 2.6 assent and 2.7 verification requirements.
7. E2E uses synthetic accounts only.

## Consequences

- Familiar Next.js session patterns with adapter isolation.
- Email deliverability and provider DPA review become a staging/production prerequisite.
- Sessions for `pending_onboarding` accounts need capability checks so auth ≠ institutional activation.
