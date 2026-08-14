import { commonsDiscussionRevisions, commonsDiscussions } from "@/db/schema";
import type { FoundationDb } from "@/db/types";
import { insertGovernanceRecord } from "@/lib/governance/repository";
import {
  SYNTHETIC_ORG_ALPHA_CONFIG_ID,
  SYNTHETIC_ORG_ALPHA_ID,
} from "@/db/seeds/v2-organizations";

export const SYNTHETIC_COMMONS_AUTHOR_ACCOUNT_ID = "account-ostt-synth-ada";

const CREATED_AT = new Date("2026-08-10T15:00:00.000Z");

type SeedDiscussion = {
  id: string;
  publicId: string;
  category:
    | "moderator_communications"
    | "council_communications"
    | "qualified_topic_discussions"
    | "qualified_approach_discussions"
    | "community_actions"
    | "topic_proposals"
    | "approach_proposals"
    | "general_discussion"
    | "disqualified_topics";
  formal: boolean;
  title: string;
  body: string;
  parentDiscussionId?: string;
  topicGovernanceRecordId?: string;
};

/**
 * Labeled synthetic Commons catalog for the alpha hall. Hideable via
 * COMMONHALL_SYNTHETIC_SEED=off (list DTOs omit synthetic=true rows).
 * Does not convert legacy Idea Commons fixtures into v2 formal content.
 */
export async function seedV2Commons(db: FoundationDb): Promise<void> {
  await insertGovernanceRecord(db, {
    id: "govrec_ostt_synth_alpha_topic_draft",
    organizationId: SYNTHETIC_ORG_ALPHA_ID,
    publicId: "gov-ostt-synth-alpha-topic-draft",
    state: "informal_draft",
    configVersionId: SYNTHETIC_ORG_ALPHA_CONFIG_ID,
    authorAccountId: SYNTHETIC_COMMONS_AUTHOR_ACCOUNT_ID,
    synthetic: true,
  });
  await insertGovernanceRecord(db, {
    id: "govrec_ostt_synth_alpha_topic_pending",
    organizationId: SYNTHETIC_ORG_ALPHA_ID,
    publicId: "gov-ostt-synth-alpha-topic-pending",
    state: "formal_review_pending",
    configVersionId: SYNTHETIC_ORG_ALPHA_CONFIG_ID,
    authorAccountId: SYNTHETIC_COMMONS_AUTHOR_ACCOUNT_ID,
    predecessorRecordId: "govrec_ostt_synth_alpha_topic_draft",
    synthetic: true,
  });

  const discussions: SeedDiscussion[] = [
    {
      id: "cdisc_ostt_synth_alpha_moderator",
      publicId: "cpub-ostt-synth-alpha-moderator",
      category: "moderator_communications",
      formal: true,
      title: "Synthetic moderator note: how qualification works",
      body: "Synthetic seed. Moderators check published criteria and safety, not whether they agree with a proposal. This is not an endorsement.",
    },
    {
      id: "cdisc_ostt_synth_alpha_council",
      publicId: "cpub-ostt-synth-alpha-council",
      category: "council_communications",
      formal: true,
      title: "Synthetic Council notice: this hall is a pre-alpha fixture",
      body: "Synthetic seed. Council communications here are labeled fixtures. They do not represent a statutory or nonprofit body.",
    },
    {
      id: "cdisc_ostt_synth_alpha_qualified_topic",
      publicId: "cpub-ostt-synth-alpha-qualified-topic",
      category: "qualified_topic_discussions",
      formal: true,
      title: "Synthetic qualified topic discussion: transit reliability",
      body: "Synthetic seed. Formal means criteria were checked. Preference, evidence quality, and later Chamber or Council action remain separate.",
    },
    {
      id: "cdisc_ostt_synth_alpha_qualified_approach",
      publicId: "cpub-ostt-synth-alpha-qualified-approach",
      category: "qualified_approach_discussions",
      formal: true,
      title: "Synthetic qualified approach: staged evening service",
      body: "Synthetic seed. An approach discussion after qualification. Not a Chamber vote and not a live consultation.",
    },
    {
      id: "cdisc_ostt_synth_alpha_action",
      publicId: "cpub-ostt-synth-alpha-action",
      category: "community_actions",
      formal: true,
      title: "Synthetic community action: publish the meeting calendar",
      body: "Synthetic seed. Community actions are listed after qualification. This row is a fixture, not a live work item.",
    },
    {
      id: "cdisc_ostt_synth_alpha_topic_draft",
      publicId: "cpub-ostt-synth-alpha-topic-draft",
      category: "topic_proposals",
      formal: false,
      title: "Synthetic topic proposal: evening bus frequency (informal draft)",
      body: "Synthetic seed. Informal topic proposal in informal_draft. A member would still need kernel submit_for_formal_review; this cannot jump to Agenda or Chamber.",
      topicGovernanceRecordId: "govrec_ostt_synth_alpha_topic_draft",
    },
    {
      id: "cdisc_ostt_synth_alpha_topic_pending",
      publicId: "cpub-ostt-synth-alpha-topic-pending",
      category: "topic_proposals",
      formal: false,
      title: "Synthetic topic proposal: evening bus frequency (formal review pending)",
      body: "Synthetic seed. Lineage child of the informal draft. State is formal_review_pending. Qualification is a separate moderator record.",
      parentDiscussionId: "cdisc_ostt_synth_alpha_topic_draft",
      topicGovernanceRecordId: "govrec_ostt_synth_alpha_topic_pending",
    },
    {
      id: "cdisc_ostt_synth_alpha_approach",
      publicId: "cpub-ostt-synth-alpha-approach",
      category: "approach_proposals",
      formal: false,
      title: "Synthetic approach proposal: timed transfers at the river hub",
      body: "Synthetic seed. Informal approach proposal. Presence here is not endorsement.",
    },
    {
      id: "cdisc_ostt_synth_alpha_general",
      publicId: "cpub-ostt-synth-alpha-general",
      category: "general_discussion",
      formal: false,
      title: "Synthetic general discussion: weekend library hours",
      body: "Synthetic seed. General discussion under the unreviewed-content disclaimer. Not a qualified topic.",
    },
    {
      id: "cdisc_ostt_synth_alpha_disqualified",
      publicId: "cpub-ostt-synth-alpha-disqualified",
      category: "disqualified_topics",
      formal: false,
      title: "Synthetic Disqualified Topic: seasonal trail lighting (honorable)",
      body: "Synthetic seed. Honorable loss of qualification is not punishment. Unsafe or dishonorable content is not listed here.",
    },
  ];

  await db.insert(commonsDiscussions).values(
    discussions.map((row) => ({
      id: row.id,
      organizationId: SYNTHETIC_ORG_ALPHA_ID,
      publicId: row.publicId,
      category: row.category,
      formal: row.formal,
      visibility: "listed" as const,
      authorAccountId: SYNTHETIC_COMMONS_AUTHOR_ACCOUNT_ID,
      title: row.title,
      body: row.body,
      parentDiscussionId: row.parentDiscussionId ?? null,
      topicGovernanceRecordId: row.topicGovernanceRecordId ?? null,
      synthetic: true,
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
    })),
  );

  await db.insert(commonsDiscussionRevisions).values(
    discussions.map((row, index) => ({
      id: `crev_ostt_synth_alpha_${index + 1}`,
      organizationId: SYNTHETIC_ORG_ALPHA_ID,
      discussionId: row.id,
      revisionNumber: 1,
      editorAccountId: SYNTHETIC_COMMONS_AUTHOR_ACCOUNT_ID,
      title: row.title,
      body: row.body,
      category: row.category,
      synthetic: true,
      createdAt: CREATED_AT,
    })),
  );
}
