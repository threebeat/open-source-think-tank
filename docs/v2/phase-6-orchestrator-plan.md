# Phase 6 orchestrator plan — legacy retirement, test rewrite, reset, final overview

**Status:** Prepared in advance. Start only after the Phase 5 PR exists.

**Authorized phase:** Phase 6 only. This is the delivery phase for Commonhall pre-alpha.

## Required work

1. Delete or hard-redirect leftover think-tank routes and duplicate handlers: `/idea-commons`, `/formal-topics`, `/deliberation`, `/decisions`, `/process` (old copy), `/topics`, `/transparency` as product IA. Keep measured 301/308 to Commonhall equivalents where a test still needs a link check, then remove compatibility tests.
2. Replace remaining e2e/unit assertions that require old headings, invite-only enrollment, or OSTT product language.
3. Confirm `alpha-reset-manifest` classifies every `pgTable`. Document pre-alpha → alpha: run operator reset, set `COMMONHALL_SYNTHETIC_SEED` as Council directs.
4. Write `docs/v2/final_overview.md` for Council (runbook, architecture map, synthetic disable, reset, **vendor and legal holds**).
5. Full `CI / required` green.

## Vendor / legal holds (must appear in final_overview)

- V2-01 name/trademark
- V2-02 / counsel terms for community standards
- V2-04 production matching
- V2-07–V2-10 production numeric rules
- V2-11–V2-13 hosted Pol.is DPA, CSP, retention, incident
- V2-14–V2-16 production suppression/map/dishonorable metadata
- V2-18 email, hosted DB, analytics
- V2-22 email verification / recovery
- V2-23 distributed bot vendor
- V2-21 production public-observer access without login (charter vs pre-alpha gate)

## Exit

Commonhall is the only active product. Members enroll, post, and follow the synthetic institutional journey. Unauthenticated users see landing + demo only. No claim of production readiness.
