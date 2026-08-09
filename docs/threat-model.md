# Threat model (Phase 1 → pilot)

**Status:** Design threat model for a future production system. Phase 1 is a static synthetic demonstration with no real accounts, identity vendors, Pol.is, payments, or production participant data.

Threats below are intentional planning targets, not claims that the demo currently mitigates them in production.

## Assets

- Trust in evidence quality labels vs popularity
- Integrity of agenda thresholds and published calculation traces
- Legitimacy of deliberation and Policy Council recommendations
- Privacy of identity-assurance and granular political-opinion data
- Public decision and minority-report records
- Moderator and administrator privilege boundaries

## Threats and Phase 1 posture

### Sybil accounts

Many fake participants distort consultations or council selection.

- **Phase 1:** No real accounts; consultation practice votes are local only.
- **Later:** Verification ladder, rate limits, conversation-scoped pseudonyms, detection of coordinated enrollment. Exact assurance levels remain open.

### Brigading / coordinated voting

Organized campaigns flood statements or votes.

- **Phase 1:** Sealed synthetic report is fixture data; practice votes do not personalize the sealed report.
- **Later:** Cross-group metrics, salience checks, moderation, shadow-mode algorithms, published overrides when humans intervene.

### Doxxing and harassment

Publication of private contact, location, or identity details.

- **Phase 1:** Synthetic names only; public redaction placeholder demonstrates omission of private contact channels.
- **Later:** Strict public/private classes, redaction workflow, incident response, no private payloads in public audit summaries.

### Moderator bias

Uneven statement or evidence moderation changes outcomes.

- **Phase 1:** Moderation is not live; evidence-review states are fixture-authored and labeled.
- **Later:** Dual control for sensitive actions, appeal paths, published moderation reasons, audit events for staff actions.

### Administrator abuse

Staff alter fixtures, thresholds, or decision records without visibility.

- **Phase 1:** Catalog is code-reviewed; validation rejects inconsistent decision/deliberation links.
- **Later:** Append-only audit, role separation, reproducible algorithm snapshots, board-visible override notices.

### Re-identification

Linking pseudonymous consultation behavior to real persons.

- **Phase 1:** No real opinion histories.
- **Later:** Minimize join keys, separate identity store from opinion store, aggregate-first public reports, counsel review before any research release.

### Data breach

Exfiltration of accounts, verification artifacts, or opinion matrices.

- **Phase 1:** No production datastore; local storage is non-sensitive demo state.
- **Later:** Encryption in transit/at rest, least privilege, retention limits, breach playbooks, no secrets in client bundles.

### Algorithm gaming

Participants or operators optimize for threshold metrics rather than honest consultation.

- **Phase 1:** UI states that thresholds are separate and that there is no combined truth score.
- **Later:** Shadow-mode algorithms, parameter publication, adversarial review of metrics, human review that can defer without inventing a popularity override.

## Explicit non-goals for Phase 1

- Production authentication, CAPTCHA, or bot defense
- Live Pol.is threat integration
- Penetration-test certification
- Claiming statistical representation of any population
