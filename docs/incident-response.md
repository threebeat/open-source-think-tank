# Incident response and privileged access (Phase 2 foundation)

**Status:** Engineering procedure for the gated foundation (WP 2.11). Not a counsel-approved legal playbook.

## Privileged access

| Access | Who | Controls |
| --- | --- | --- |
| Restricted audit search | auditor, administrator | `audit.read_restricted` + L2 assurance; no private payloads in API |
| Pseudonym reverse map | auditor, administrator | `pseudonym.privileged_lookup` + L3; reason + audit; expired/rotated allowed; deleted withheld |
| Legal hold place/release | administrator | `privacy.manage_legal_hold` + L3; never public |
| Dual-control approve | second administrator | Requester cannot approve own request |
| Account export | account holder (self) | Own rows only; cross-account IDs abort export |

## Incident response outline

1. **Detect** — security log channel (`securityLog`), audit continuity failure, abuse report, or staff observation.
2. **Contain** — revoke sessions (`revoke-all`), place legal hold on affected account/subject, disable public-demo confusion by confirming `APP_MODE`.
3. **Investigate** — restricted audit search; privileged pseudonym lookup only with written reason; do not paste production participant data into prompts.
4. **Eradicate / recover** — rotate `AUTH_SECRET` and DB credentials on suspected exposure; restore from documented backup point (migrate + seed for ephemeral; host PITR for future managed DB after addendum).
5. **Post-incident** — append institutional audit summaries where appropriate; update threat model if a new class of abuse appeared; counsel review before public statements.

## Dual control (practical scope)

Highest-impact operations that use two-administrator approval today:

- Release of legal holds (request + distinct approver before/with release workflow)
- Closure execution may be gated through dual-control request payload `privacy.execute_closure`

Ordinary role grants still require reason + audit + self-elevation bans; last-admin/last-auditor protections remain.
