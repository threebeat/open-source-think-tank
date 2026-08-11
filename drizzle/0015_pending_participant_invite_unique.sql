-- At most one pending participant invitation per normalized contact.
-- Historical accepted/expired/revoked rows are unconstrained.
-- Does not affect the separate one-live-bootstrap-invitation invariant.
CREATE UNIQUE INDEX "invitations_one_pending_participant_contact_uidx"
ON "invitations" (lower("intended_contact_channel"))
WHERE "kind" = 'participant' AND "status" = 'pending';
