/**
 * Shared rollback SQL for isolation proofs.
 * Order when rolling back through organizations: 0027 → 0026 → 0025 → 0023.
 */

export const ROLLBACK_0027 = `
DROP TRIGGER IF EXISTS ostt_council_roll_call_parent_match ON council_roll_calls;
DROP TRIGGER IF EXISTS ostt_chamber_roll_call_parent_match ON chamber_roll_calls;
DROP TRIGGER IF EXISTS ostt_council_recommendation_parent_match ON council_recommendation_versions;
DROP TRIGGER IF EXISTS ostt_chamber_verdict_parent_match ON chamber_verdict_versions;
DROP TRIGGER IF EXISTS ostt_council_session_parent_match ON council_sessions;
DROP TRIGGER IF EXISTS ostt_chamber_session_parent_match ON chamber_sessions;
DROP FUNCTION IF EXISTS ostt_council_roll_call_parent_match();
DROP FUNCTION IF EXISTS ostt_chamber_roll_call_parent_match();
DROP FUNCTION IF EXISTS ostt_council_recommendation_parent_match();
DROP FUNCTION IF EXISTS ostt_chamber_verdict_parent_match();
DROP FUNCTION IF EXISTS ostt_council_session_parent_match();
DROP FUNCTION IF EXISTS ostt_chamber_session_parent_match();
DROP TABLE IF EXISTS council_roll_calls;
DROP TABLE IF EXISTS chamber_roll_calls;
DROP TABLE IF EXISTS council_recommendation_versions;
DROP TABLE IF EXISTS chamber_verdict_versions;
DROP TABLE IF EXISTS council_sessions;
DROP TABLE IF EXISTS chamber_sessions;
DROP TYPE IF EXISTS chamber_verdict_outcome;
DROP TYPE IF EXISTS council_session_status;
DROP TYPE IF EXISTS chamber_session_status;
DROP TYPE IF EXISTS public_roll_call_position;
`;

export const ROLLBACK_0026 = `
DROP TRIGGER IF EXISTS ostt_member_position_parent_match ON member_statement_positions;
DROP FUNCTION IF EXISTS ostt_member_position_parent_match();
DROP TABLE IF EXISTS member_statement_positions;
DROP TYPE IF EXISTS member_statement_position;
DROP INDEX IF EXISTS topic_governance_records_org_slug_uidx;
DROP INDEX IF EXISTS topic_governance_records_org_provider_entity_uidx;
ALTER TABLE topic_governance_records
  DROP CONSTRAINT IF EXISTS topic_governance_records_fixture_conversation_fk,
  DROP CONSTRAINT IF EXISTS topic_governance_records_slug_nonblank,
  DROP CONSTRAINT IF EXISTS topic_governance_records_title_nonblank,
  DROP COLUMN IF EXISTS slug,
  DROP COLUMN IF EXISTS title,
  DROP COLUMN IF EXISTS question,
  DROP COLUMN IF EXISTS overview,
  DROP COLUMN IF EXISTS synthetic_evidence,
  DROP COLUMN IF EXISTS synthetic_statements,
  DROP COLUMN IF EXISTS fixture_conversation_id,
  DROP COLUMN IF EXISTS current_provider_entity_id;
`;

export const ROLLBACK_0025 = `
DROP TRIGGER IF EXISTS commons_discussion_revisions_immutable ON commons_discussion_revisions;
DROP TRIGGER IF EXISTS ostt_commons_revision_parent_match ON commons_discussion_revisions;
DROP TRIGGER IF EXISTS ostt_commons_parent_discussion_match ON commons_discussions;
DROP FUNCTION IF EXISTS ostt_commons_revision_parent_match();
DROP FUNCTION IF EXISTS ostt_commons_parent_discussion_match();
DROP TABLE IF EXISTS commons_discussion_revisions;
DROP TABLE IF EXISTS commons_discussions;
DROP TYPE IF EXISTS commons_discussion_visibility;
DROP TYPE IF EXISTS commons_discussion_category;
`;

export const ROLLBACK_0023 = `
DROP TRIGGER IF EXISTS topic_governance_events_immutable ON topic_governance_events;
DROP TRIGGER IF EXISTS organization_membership_events_immutable ON organization_membership_events;
DROP TRIGGER IF EXISTS ostt_membership_event_parent_match ON organization_membership_events;
DROP TRIGGER IF EXISTS ostt_appointment_conflict_parent_match ON appointment_conflicts_and_recusals;
DROP TRIGGER IF EXISTS ostt_governance_event_parent_match ON topic_governance_events;
DROP FUNCTION IF EXISTS ostt_membership_event_parent_match();
DROP FUNCTION IF EXISTS ostt_appointment_conflict_parent_match();
DROP FUNCTION IF EXISTS ostt_governance_event_parent_match();
ALTER TABLE audit_events DROP COLUMN IF EXISTS projection_class;
ALTER TABLE audit_events DROP COLUMN IF EXISTS capability;
ALTER TABLE audit_events DROP COLUMN IF EXISTS actor_principal_kind;
ALTER TABLE audit_events DROP COLUMN IF EXISTS organization_id;
DROP TABLE IF EXISTS appointment_conflicts_and_recusals;
DROP TABLE IF EXISTS topic_governance_events;
DROP TABLE IF EXISTS topic_governance_records;
DROP TABLE IF EXISTS organization_appointments;
DROP TABLE IF EXISTS organization_membership_events;
DROP TABLE IF EXISTS organization_memberships;
DROP TABLE IF EXISTS organization_config_versions;
DROP TABLE IF EXISTS organization_service_areas;
DROP TABLE IF EXISTS organizations;
DROP TYPE IF EXISTS topic_governance_action;
DROP TYPE IF EXISTS topic_governance_state;
DROP TYPE IF EXISTS audit_projection_class;
DROP TYPE IF EXISTS actor_principal_kind;
DROP TYPE IF EXISTS appointment_conflict_kind;
DROP TYPE IF EXISTS organization_appointment_kind;
DROP TYPE IF EXISTS organization_membership_event_kind;
DROP TYPE IF EXISTS organization_membership_status;
DROP TYPE IF EXISTS organization_config_status;
DROP TYPE IF EXISTS organization_service_status;
`;

/** Drop later dependents before organizations (0023). */
export const ROLLBACK_CHAIN_THROUGH_0023 = [
  ROLLBACK_0027,
  ROLLBACK_0026,
  ROLLBACK_0025,
  ROLLBACK_0023,
].join("\n");
