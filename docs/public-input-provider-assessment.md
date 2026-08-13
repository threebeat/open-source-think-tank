# Public Input / Pol.is capability, privacy, and vendor assessment

**Status:** Phase 4.2 engineering assessment — **still not** authorization for a live embed. Phase **4.3** built the institutional conversation lifecycle and a **disabled** embed URL shell; live Pol.is remains fail-closed.  
**Assessment date:** 2026-08-13  
**Pinned upstream OSS pin:** `compdemocracy/polis` `edge` commit `5089c6bef9eb1a1e454beb34354fb29dd0a2b6f0` (fetched 2026-08-13)  
**Related:** [ADR 0012](./decisions/0012-public-input-provider-boundary.md), [ADR 0014](./decisions/0014-institutional-conversation-lifecycle.md), [ADR 0016](./decisions/0016-provider-embed-activation-exact-origin.md), [phase-4-plan.md](./phase-4-plan.md), OQ26–OQ29, OQ33  
**Activation checklist (code):** `src/lib/public-input/lifecycle/activation.ts` — all 13 gates ship `unresolved`

This document uses **primary sources only**. Old knowledge-base pages, beta export notes, browser-observed behavior, and undocumented source endpoints are **not** treated as a stable provider contract.

Classification legend:

| Status | Meaning |
| --- | --- |
| **supported_documented** | Stated in current official docs / checked-in repo docs / legal pages cited below |
| **observed_unsupported** | Visible in examples or marketing but not a contractual guarantee we may rely on |
| **unclear_requires_confirmation** | Public material insufficient; written vendor confirmation required |
| **unsupported_forbidden** | Out of scope for this project until explicitly approved (e.g. xid) |

---

## 1. Sources consulted

| Source | URL / pin | Used for |
| --- | --- | --- |
| Polis OSS repository | https://github.com/compdemocracy/polis @ `5089c6be…` | License (AGPL-3.0), Docker ops, JWT note in README, embed.js location |
| Embed code KB | https://compdemocracy.org/embed-code/ | Hosted iframe via `embed.js`, third-party JS requirement, `data-*` config flags, vote `postMessage` |
| Embed examples | https://github.com/compdemocracy/polis-embed-examples | Illustrates XID patterns — **examples, not contract** |
| Hosted privacy policy | https://pol.is/privacy (last updated 2022/03/07) | Controller claim, cookies/auto collection, service providers, LLM processors named, US transfer |
| Hosted terms | https://pol.is/tos | Incorporates privacy policy; service terms |
| Hosted pro pricing page | https://pro.pol.is/ | Marketing claims (EU sovereignty, XID export, raw export intervals, on-prem) — **not a DPA** |
| Self-host docs (repo) | `docs/configuration.md`, `docs/ssl.md`, `docs/scaling.md` under pin above | Operational self-host requirements |

**Explicitly out of scope / do not confuse:** `polis.ai` / Polis Educational Solutions legal pages are a different product and are not used here.

**No live pol.is conversation was contacted** during this assessment or Phase 4.2 implementation.

---

## 2. Capability matrix

Statuses are recorded **separately** for: (H) hosted pol.is, (S) self-hosted OSS Polis, (N) no-provider / synthetic fallback.

| Capability | H | S | N | Notes / sources |
| --- | --- | --- | --- | --- |
| Hosted iframe embedding + allowed config | supported_documented | supported_documented (self host + embed.js) | unsupported_forbidden | Embed KB: script + `.polis` div; requires third-party JS. Config via `data-*` (e.g. `data-ucv`, `data-ucw`, `data-show_vis`). Phase 4.3 ships exact-origin validation + fail-closed `buildEmbedUrl` (no iframe UI); CSP/third-party JS acceptance remains OQ33 / activation gate. |
| Conversation creation / configuration | unclear_requires_confirmation | supported_documented (admin UI in OSS) | unsupported_forbidden | Hosted admin API stability and org account terms need vendor confirmation. |
| Participant commenting | supported_documented | supported_documented | unsupported_forbidden | Core product behavior in KB/README; not independently SLA-backed. |
| Agree / disagree / pass voting | supported_documented | supported_documented | unsupported_forbidden | Embed emits vote `postMessage` (KB). |
| Strict / permissive moderation | unclear_requires_confirmation | unclear_requires_confirmation | unsupported_forbidden | Moderation exists conceptually; contractual behavior for our workflows unconfirmed. |
| Report generation | supported_documented (product) | supported_documented (product) | unsupported_forbidden | Privacy policy discloses LLM processors for report contextualization (OpenAI, Anthropic, Gemini) — **privacy gate**. |
| Export availability + schema stability | unclear_requires_confirmation | unclear_requires_confirmation | unsupported_forbidden | pro.pol.is markets “raw data export via API (15-minute intervals)” — marketing, not schema contract. Versioned aggregate ingest remains a 4.4 design. |
| Auth + anonymous participation | unclear_requires_confirmation | supported_documented (JWT keys in OSS README) | unsupported_forbidden | Hosted anonymous cookie continuity vs account auth needs confirmation. |
| Cookies / device continuity | supported_documented | unclear_requires_confirmation | n/a | Privacy policy: cookies and automatic collection (IP, device, actions). |
| OIDC / JWT support (current OSS) | unclear_requires_confirmation | observed_unsupported / unclear | unsupported_forbidden | OSS README mentions JWT keys for participant authentication; OIDC as a stable integration for our stack is unconfirmed. |
| xid / identity linkage | unsupported_forbidden | unsupported_forbidden | unsupported_forbidden | Embed examples demonstrate XID; pro page markets XID export. **Forbidden here until OQ28 cleared.** |
| Anonymous-but-verified participation | unclear_requires_confirmation | unclear_requires_confirmation | unsupported_forbidden | No stable public contract matching our verification ladder. |
| Single-use URLs | observed_unsupported | observed_unsupported | unsupported_forbidden | Mentioned in embed-examples (`url-token-embed`); not a contractual API. |
| Accessibility (participant / admin / report) | unclear_requires_confirmation | unclear_requires_confirmation | n/a (our synthetic UI) | No WCAG conformance statement located in primary sources reviewed. |
| Mobile behavior | unclear_requires_confirmation | unclear_requires_confirmation | n/a | Embed claims responsive width via JS; a11y/mobile QA unconfirmed. |
| Data residency | unclear_requires_confirmation | supported_documented (operator-chosen) | n/a | Privacy: transfers to United States. pro.pol.is markets “EU data sovereignty option” — needs written confirmation. |
| Subprocessors | unclear_requires_confirmation | operator-controlled | n/a | Privacy names service providers generally + Twitter/Facebook auth options + LLM vendors. No complete public subprocessor schedule / DPA found. |
| Encryption | unclear_requires_confirmation | supported_documented (TLS docs) | n/a | Self-host SSL docs exist; hosted encryption-at-rest commitments unconfirmed. |
| Retention / deletion | unclear_requires_confirmation | unclear_requires_confirmation | n/a | Privacy describes practices; conversation-level deletion/export-on-exit for our alpha wipe (OQ29) unconfirmed. |
| Account/participant data export | unclear_requires_confirmation | unclear_requires_confirmation | n/a | Distinct from aggregate report; needs vendor confirmation. |
| Breach notification | unclear_requires_confirmation | operator responsibility | n/a | No contractual SLA located in public ToS review. |
| Outage / SLA / support | unclear_requires_confirmation | operator responsibility | n/a (synthetic always available) | No public SLA located. |
| Rate limits | unclear_requires_confirmation | unclear_requires_confirmation | n/a | Not documented as a stable contract. |
| API / version compatibility | unclear_requires_confirmation | unclear_requires_confirmation | n/a | Do not treat source endpoints as API. |
| Self-hosted operational requirements | n/a | supported_documented | n/a | Docker Compose, configuration, SSL, scaling docs under pin; AGPL-3.0 obligations apply. |
| License obligations | n/a | supported_documented (AGPL-3.0) | n/a | Hosted use is under ToS; self-host copyleft obligations must be counsel-reviewed. |

---

## 3. Comparison: hosted vs self-hosted vs no-provider

| Dimension | Hosted pol.is | Self-hosted OSS Polis | No-provider / synthetic |
| --- | --- | --- | --- |
| Network dependency | Required | Required (our infra) | None |
| Data control | Vendor + named processors | Operator | Fixture-only |
| License / ToS | https://pol.is/tos + privacy | AGPL-3.0 | N/A |
| Embed | Documented script/iframe | Documented embed.js build | Forbidden / N/A |
| Identity linkage (xid) | Marketed / exemplified — **forbidden for us** | Possible in software — **forbidden for us** | None |
| Privacy unknowns | DPA, subprocessors list, residency option, retention/deletion, breach SLA | Operator must supply equivalents | N/A |
| Fit for 4.2 | Assessment only | Assessment only | **Active fallback** (`NoProvider` / fixture) |
| Fit for 4.3 | Institutional lifecycle + disabled embed shell landed; **live still blocked** | Same — live kinds non-operational | Continues as fail-closed path (`none` / `fixture` only) |
| Fit for live activation | Blocked until activation checklist clears | Blocked until ops + counsel + activation gates clear | Continues as fail-closed path |

---

## 4. Privacy and security blockers (must stay open)

1. **Written DPA / processing terms** suitable for our gated alpha (controller/processor roles) — not found as a standard public DPA.
2. **Complete subprocessor list** including LLM report processors and hosting.
3. **Data residency** commitment if EU/other residency is required.
4. **Retention, deletion, and export** aligned with alpha wipe (OQ29).
5. **xid / single-use identity URL patterns** — forbidden until OQ28.
6. **Accessibility conformance** evidence for participant/admin/report UIs.
7. **Export schema versioning** for aggregate-only ingest (4.4).
8. **CSP / iframe / third-party JS** threat acceptance (see threat-model 4.2 amendments).
9. **Permitted-services register addendum** in [phase-2-plan.md](./phase-2-plan.md) §4 — still required before install.
10. **Counsel disposition** for AGPL self-host vs hosted ToS risk.

---

## 5. Verdict

**Insufficient information to authorize a live Pol.is integration.**

Phase 4.3 does **not** change this verdict. It adds:

- Gated institutional conversation lifecycle (`public_input_conversations` + transitions)
- Fail-closed embed URL construction behind an exhaustive unresolved activation checklist
- Progressive evidence disclosure (readability only; unrelated to provider install)

Recommended engineering posture for now:

1. Keep **provider-neutral adapter** with fixture + no-provider fail-closed paths (4.2 — done).
2. Keep conversation registry limited to operational kinds **`none` / `fixture`** (4.3 — done).
3. Do **not** add live credentials, env vars, SDKs, network clients, or iframe UI until activation.
4. Prefer continuing **synthetic aggregates** on public-demo until gates clear.
5. Before live activation: clear every gate in `LIVE_PUBLIC_INPUT_ACTIVATION_GATES` (see [phase-4-plan.md](./phase-4-plan.md) §11d), update the permitted-services register, obtain privacy + security + counsel approvals, then owner language equivalent to `ENABLE LIVE POLIS FOR GATED ALPHA`.

Owner risk acceptance is **not** equivalent to counsel `cleared` status. Starting or completing Phase 4.3 engineering is **not** live-provider authorization.
