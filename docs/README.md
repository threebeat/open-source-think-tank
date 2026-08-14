# Documentation map

## Active Commonhall v2 contract

Read in this order:

1. [`product-charter.md`](./product-charter.md)
2. [`v2/governance-state-machine.json`](./v2/governance-state-machine.json)
3. [`v2/governance-lifecycle.md`](./v2/governance-lifecycle.md)
4. [`v2/community-standards.md`](./v2/community-standards.md)
5. [`v2/architecture.md`](./v2/architecture.md)
6. [`v2/testing-strategy.md`](./v2/testing-strategy.md)
7. [`v2/ci-pr-workflow.md`](./v2/ci-pr-workflow.md)
8. [`v2/open-decisions.md`](./v2/open-decisions.md)
9. [`v2/implementation-plan.md`](./v2/implementation-plan.md)
10. [`v2/cursor-cloud-agent-prompt.md`](./v2/cursor-cloud-agent-prompt.md)

Architecture decision: [`decisions/0022-commonhall-v2-reset.md`](./decisions/0022-commonhall-v2-reset.md).

Council delivery overview (does not replace the charter): [`v2/final_overview.md`](./v2/final_overview.md).

## Current operational references to preserve during migration

These documents remain operationally relevant until a v2 replacement is accepted: `threat-model.md`, `incident-response.md`, `secrets-and-operations.md`, `data-map.md`, `alpha-reset-runbook.md`, `alpha-reset-classification.md`, `capability-matrix.md`, and `public-input-provider-assessment.md`.

When they conflict with the v2 product/authority model, preserve the stricter security/privacy behavior and open a v2 decision; do not reintroduce the old institutional model.

## Historical Phase 1–4 material

All documents named `phase-*`, `architecture-phase-*`, `*-mvp-plan.md`, and decisions 0001–0021 describe how the current repository was built. They are valuable migration evidence but no longer authorize new product behavior after ADR 0022.

Cloud agents must not select a historical package because it says “active.” The current implementation phase is always the one expressly authorized from [`v2/implementation-plan.md`](./v2/implementation-plan.md).

