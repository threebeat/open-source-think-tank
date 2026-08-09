import type { FixtureCatalog } from "@/domain/types";

/**
 * All Phase 1 demonstration data. Every person, organization, source, vote,
 * and decision is fictional and marked synthetic at the catalog and top-level
 * entity layers.
 */
export const fixtureCatalog = {
  synthetic: true,
  topics: [
    {
      id: "topic-cedar-river-drought-surcharge",
      slug: "cedar-river-drought-surcharge",
      synthetic: true,
      title: "Cedar River residential drought surcharge",
      question:
        "Should the fictional Cedar River Water District adopt a graduated residential drought-surcharge schedule when reservoir storage falls below published thresholds?",
      background:
        "The fictional Cedar River Water District serves about 180,000 accounts in a temperate river basin. After two dry winters in the synthetic scenario, reservoir storage declined faster than the ten-year median. The district already uses voluntary conservation messaging. Staff prepared options for a temporary, published surcharge that rises with shortage stage. No real utility or jurisdiction is depicted.",
      scope:
        "Residential meter accounts inside the district boundary during declared shortage stages only. Commercial and industrial tariffs, wholesale contracts, and permanent rate redesign are out of scope for this demonstration topic.",
      stage: "decision",
      status: "closed",
      subjectTags: ["water", "pricing", "conservation", "local-services"],
      claimIds: [
        "claim-graduated-surcharge",
        "claim-flat-emergency-fee",
        "claim-voluntary-only",
      ],
      changelog: [
        {
          at: "2026-01-12",
          summary: "Synthetic topic brief published for demonstration.",
        },
        {
          at: "2026-02-03",
          summary: "Evidence pack attached with mixed review states.",
        },
        {
          at: "2026-03-01",
          summary: "Open consultation closed; mock results fixed for demo.",
        },
        {
          at: "2026-03-18",
          summary: "Agenda review recorded; item qualified with human notes.",
        },
        {
          at: "2026-04-22",
          summary:
            "Policy Council recommendation published with scheduled review date.",
        },
      ],
      nextStep:
        "Scheduled review of the Policy Council recommendation; any governing-board adoption remains unresolved.",
      participationSummary:
        "Synthetic consultation: 1,240 participants; not a representative sample.",
    },
    {
      id: "topic-millbrook-ems-open-data",
      slug: "millbrook-ems-open-data",
      synthetic: true,
      title: "Millbrook County EMS response-time open data",
      question:
        "Should the fictional Millbrook County publish anonymized monthly EMS response-time summaries by service zone?",
      background:
        "Fictional Millbrook County operates a mixed career and volunteer EMS system. Advocacy groups in the scenario asked for zone-level response-time transparency. Privacy staff flagged re-identification risks for sparsely populated zones. This topic is early in the demonstration pipeline.",
      scope:
        "Monthly aggregated response-time statistics by service zone. Individual incident records, patient information, and staff identities are out of scope.",
      stage: "brief",
      status: "open",
      subjectTags: ["public-safety", "open-data", "privacy"],
      claimIds: [],
      changelog: [
        {
          at: "2026-05-02",
          summary: "Synthetic brief opened; claims not yet submitted.",
        },
      ],
      nextStep: "Invite competing claims and candidate evidence sources.",
    },
    {
      id: "topic-northline-start-times",
      slug: "northline-secondary-start-times",
      synthetic: true,
      title: "Northline secondary-school start times",
      question:
        "Should the fictional Northline School District pilot later start times for secondary schools?",
      background:
        "Fictional Northline School District is weighing a two-school pilot of later secondary start times. Transportation routing, athletics schedules, and household childcare constraints appear in early claims. Evidence review has started but consultation has not.",
      scope:
        "A one-year pilot at two secondary campuses. Elementary schedules and permanent district-wide adoption are out of scope until pilot evaluation.",
      stage: "evidence",
      status: "paused",
      subjectTags: ["education", "health", "transportation"],
      claimIds: [
        "claim-northline-later-start",
        "claim-northline-keep-current",
      ],
      changelog: [
        {
          at: "2026-04-10",
          summary: "Synthetic brief and initial claims posted.",
        },
        {
          at: "2026-04-28",
          summary: "First evidence sources entered review.",
        },
      ],
      nextStep: "Complete evidence review before opening consultation.",
    },
  ],
  claims: [
    {
      id: "claim-graduated-surcharge",
      synthetic: true,
      topicId: "topic-cedar-river-drought-surcharge",
      title: "Graduated surcharge tied to shortage stage",
      summary:
        "A published, stage-based residential surcharge can reduce peak use while keeping low indoor-use households at lower incremental cost than a flat emergency fee.",
      approachLabel: "Approach 1 — graduated stage surcharge",
      supportingEvidenceIds: [
        "evidence-basin-storage-note",
        "evidence-meter-elasticity-study",
      ],
      counterEvidenceIds: ["evidence-equity-impact-memo"],
    },
    {
      id: "claim-flat-emergency-fee",
      synthetic: true,
      topicId: "topic-cedar-river-drought-surcharge",
      title: "Flat temporary emergency fee",
      summary:
        "A single temporary flat fee is simpler to administer and communicate than a multi-stage schedule, though it may burden low-use households unevenly.",
      approachLabel: "Approach 2 — flat emergency fee",
      supportingEvidenceIds: ["evidence-billing-ops-brief"],
      counterEvidenceIds: [
        "evidence-meter-elasticity-study",
        "evidence-customer-complaint-digest",
      ],
    },
    {
      id: "claim-voluntary-only",
      synthetic: true,
      topicId: "topic-cedar-river-drought-surcharge",
      title: "Extend voluntary conservation only",
      summary:
        "Continued voluntary messaging and leak-repair aid may preserve trust and avoid price shocks, but prior dry seasons in the scenario showed limited peak reductions.",
      approachLabel: "Approach 3 — voluntary measures only",
      supportingEvidenceIds: ["evidence-outreach-panel"],
      counterEvidenceIds: [
        "evidence-basin-storage-note",
        "evidence-prior-season-audit",
      ],
    },
    {
      id: "claim-northline-later-start",
      synthetic: true,
      topicId: "topic-northline-start-times",
      title: "Pilot later secondary start times",
      summary:
        "A limited pilot could test effects on attendance and student sleep while documenting transportation tradeoffs.",
      approachLabel: "Approach A — later-start pilot",
      supportingEvidenceIds: ["evidence-northline-sleep-review"],
      counterEvidenceIds: ["evidence-northline-bus-constraint"],
    },
    {
      id: "claim-northline-keep-current",
      synthetic: true,
      topicId: "topic-northline-start-times",
      title: "Keep current start times pending fuller costing",
      summary:
        "Without a full transportation cost model, changing start times risks service gaps for households relying on current bus waves.",
      approachLabel: "Approach B — maintain current schedule",
      supportingEvidenceIds: ["evidence-northline-bus-constraint"],
      counterEvidenceIds: ["evidence-northline-sleep-review"],
    },
  ],
  evidenceSources: [
    {
      id: "evidence-basin-storage-note",
      synthetic: true,
      topicId: "topic-cedar-river-drought-surcharge",
      title: "Cedar Basin storage outlook (synthetic staff note)",
      organization: "Cedar River Water District Planning Office (fictional)",
      authorType: "agency",
      sourceType: "memo",
      publishedOn: "2026-01-20",
      reviewStatus: "accepted",
      conflicts: "None disclosed in the synthetic record.",
      limitations:
        "Internal projection using district models; not an external audit.",
      summary:
        "States that storage fell below the district’s published Stage 2 threshold earlier than the ten-year median.",
    },
    {
      id: "evidence-meter-elasticity-study",
      synthetic: true,
      topicId: "topic-cedar-river-drought-surcharge",
      title: "Residential meter response under staged prices",
      organization: "Clearcurrent Methods Lab (fictional)",
      authorType: "researcher",
      sourceType: "peer_reviewed",
      publishedOn: "2024-11-02",
      reviewStatus: "accepted",
      conflicts:
        "Lab previously held a training contract with another fictional utility consortium; disclosed.",
      limitations:
        "Based on three fictional peer utilities; climate and housing stock differ from Cedar River.",
      summary:
        "Finds larger peak-use reductions under graduated stage prices than under flat emergency fees in the studied sample.",
    },
    {
      id: "evidence-equity-impact-memo",
      synthetic: true,
      topicId: "topic-cedar-river-drought-surcharge",
      title: "Household bill impact vignettes",
      organization: "Rivermarch Household Policy Desk (fictional)",
      authorType: "civil_society",
      sourceType: "report",
      publishedOn: "2026-02-08",
      reviewStatus: "limited",
      conflicts: "Advocacy organization; funding from a regional foundation (fictional).",
      limitations:
        "Vignettes are illustrative, not a statistically representative burden study.",
      summary:
        "Argues low indoor-use households can still face hardship if outdoor irrigation neighbors drive stage declarations.",
    },
    {
      id: "evidence-billing-ops-brief",
      synthetic: true,
      topicId: "topic-cedar-river-drought-surcharge",
      title: "Billing system change estimate",
      organization: "Cedar River Customer Systems Team (fictional)",
      authorType: "agency",
      sourceType: "memo",
      publishedOn: "2026-02-11",
      reviewStatus: "pending",
      conflicts: "None disclosed in the synthetic record.",
      limitations: "Cost estimate only; no vendor quote attached.",
      summary:
        "Estimates fewer configuration hours for a flat fee than for a multi-stage surcharge table.",
    },
    {
      id: "evidence-customer-complaint-digest",
      synthetic: true,
      topicId: "topic-cedar-river-drought-surcharge",
      title: "Prior flat-fee complaint themes",
      organization: "Lakeside Civic Reporting Cooperative (fictional)",
      authorType: "journalist",
      sourceType: "news",
      publishedOn: "2023-08-14",
      reviewStatus: "disputed",
      conflicts: "Outlet accepts sponsored content from regional businesses (fictional).",
      limitations:
        "Qualitative complaint themes; not a validated survey of account holders.",
      summary:
        "Describes public confusion and perceived unfairness during a prior flat emergency fee in a neighboring fictional district.",
    },
    {
      id: "evidence-outreach-panel",
      synthetic: true,
      topicId: "topic-cedar-river-drought-surcharge",
      title: "Voluntary conservation panel summary",
      organization: "Basin Neighbors Forum (fictional)",
      authorType: "civil_society",
      sourceType: "report",
      publishedOn: "2025-09-30",
      reviewStatus: "limited",
      conflicts: "Forum board includes two landscaping business owners (fictional).",
      limitations: "Self-selected panel; not a random sample.",
      summary:
        "Participants favored leak-repair aid and messaging before price tools.",
    },
    {
      id: "evidence-prior-season-audit",
      synthetic: true,
      topicId: "topic-cedar-river-drought-surcharge",
      title: "Prior dry-season conservation audit",
      organization: "Independent Basin Review Office (fictional)",
      authorType: "researcher",
      sourceType: "report",
      publishedOn: "2025-12-05",
      reviewStatus: "accepted",
      conflicts: "None disclosed in the synthetic record.",
      limitations: "Observational; cannot isolate messaging effects from weather.",
      summary:
        "Reports modest peak reductions under voluntary-only measures during the previous synthetic dry season.",
    },
    {
      id: "evidence-vendor-whitepaper",
      synthetic: true,
      topicId: "topic-cedar-river-drought-surcharge",
      title: "Smart-irrigation controller savings claims",
      organization: "GreenLatch Devices (fictional vendor)",
      authorType: "industry",
      sourceType: "other",
      publishedOn: "2025-06-01",
      reviewStatus: "rejected",
      conflicts: "Vendor marketing material.",
      limitations: "Unverified product claims; not district-specific.",
      summary:
        "Promotes device subsidies as a substitute for any surcharge; excluded from reliance in the synthetic review.",
    },
    {
      id: "evidence-northline-sleep-review",
      synthetic: true,
      topicId: "topic-northline-start-times",
      title: "Adolescent sleep and start-time evidence scan",
      organization: "Northline Instructional Research Cell (fictional)",
      authorType: "researcher",
      sourceType: "report",
      publishedOn: "2026-03-15",
      reviewStatus: "pending",
      conflicts: "None disclosed in the synthetic record.",
      limitations: "Literature scan; no local student data yet.",
      summary:
        "Summarizes external studies associating later secondary start times with additional sleep in some settings.",
    },
    {
      id: "evidence-northline-bus-constraint",
      synthetic: true,
      topicId: "topic-northline-start-times",
      title: "Transportation wave capacity memo",
      organization: "Northline Pupil Transportation (fictional)",
      authorType: "agency",
      sourceType: "memo",
      publishedOn: "2026-04-01",
      reviewStatus: "accepted",
      conflicts: "None disclosed in the synthetic record.",
      limitations: "Assumes current fleet size and driver availability.",
      summary:
        "States that a 40-minute secondary shift would require an additional bus wave or route consolidation.",
    },
  ],
  consultationStatements: [
    {
      id: "stmt-publish-thresholds",
      synthetic: true,
      topicId: "topic-cedar-river-drought-surcharge",
      text: "Shortage stages and surcharge amounts should be published before they take effect.",
      relatedClaimIds: ["claim-graduated-surcharge"],
      relatedEvidenceIds: ["evidence-basin-storage-note"],
      isCrossGroupConsensus: true,
      isHighDisagreement: false,
      isPopularWeakEvidence: false,
      isLessPopularStrongEvidence: false,
    },
    {
      id: "stmt-protect-indoor-essential",
      synthetic: true,
      topicId: "topic-cedar-river-drought-surcharge",
      text: "Essential indoor use should face a lower incremental price than discretionary outdoor use.",
      relatedClaimIds: ["claim-graduated-surcharge"],
      relatedEvidenceIds: ["evidence-meter-elasticity-study"],
      isCrossGroupConsensus: true,
      isHighDisagreement: false,
      isPopularWeakEvidence: false,
      isLessPopularStrongEvidence: false,
    },
    {
      id: "stmt-flat-fee-simpler",
      synthetic: true,
      topicId: "topic-cedar-river-drought-surcharge",
      text: "A flat emergency fee is preferable because it is easier to explain on a bill.",
      relatedClaimIds: ["claim-flat-emergency-fee"],
      relatedEvidenceIds: ["evidence-billing-ops-brief"],
      isCrossGroupConsensus: false,
      isHighDisagreement: true,
      isPopularWeakEvidence: false,
      isLessPopularStrongEvidence: false,
    },
    {
      id: "stmt-no-price-tools",
      synthetic: true,
      topicId: "topic-cedar-river-drought-surcharge",
      text: "The district should avoid any price tool and rely only on voluntary messaging.",
      relatedClaimIds: ["claim-voluntary-only"],
      relatedEvidenceIds: ["evidence-outreach-panel"],
      isCrossGroupConsensus: false,
      isHighDisagreement: true,
      isPopularWeakEvidence: false,
      isLessPopularStrongEvidence: false,
    },
    {
      id: "stmt-device-subsidies-popular",
      synthetic: true,
      topicId: "topic-cedar-river-drought-surcharge",
      text: "Subsidizing smart irrigation controllers would make surcharges unnecessary.",
      relatedClaimIds: ["claim-voluntary-only"],
      relatedEvidenceIds: ["evidence-vendor-whitepaper"],
      isCrossGroupConsensus: false,
      isHighDisagreement: false,
      isPopularWeakEvidence: true,
      isLessPopularStrongEvidence: false,
    },
    {
      id: "stmt-audit-before-fee",
      synthetic: true,
      topicId: "topic-cedar-river-drought-surcharge",
      text: "An independent conservation audit should be published alongside any surcharge decision.",
      relatedClaimIds: ["claim-graduated-surcharge", "claim-voluntary-only"],
      relatedEvidenceIds: ["evidence-prior-season-audit"],
      isCrossGroupConsensus: false,
      isHighDisagreement: false,
      isPopularWeakEvidence: false,
      isLessPopularStrongEvidence: true,
    },
    {
      id: "stmt-hardship-rebate",
      synthetic: true,
      topicId: "topic-cedar-river-drought-surcharge",
      text: "Any surcharge package should include a clear hardship rebate path for qualifying households.",
      relatedClaimIds: ["claim-graduated-surcharge", "claim-flat-emergency-fee"],
      relatedEvidenceIds: ["evidence-equity-impact-memo"],
      isCrossGroupConsensus: false,
      isHighDisagreement: false,
      isPopularWeakEvidence: false,
      isLessPopularStrongEvidence: false,
    },
    {
      id: "stmt-sunset-clause",
      synthetic: true,
      topicId: "topic-cedar-river-drought-surcharge",
      text: "Surcharge authority should sunset unless re-authorized after a scheduled review.",
      relatedClaimIds: ["claim-graduated-surcharge"],
      relatedEvidenceIds: [],
      isCrossGroupConsensus: false,
      isHighDisagreement: false,
      isPopularWeakEvidence: false,
      isLessPopularStrongEvidence: false,
    },
  ],
  opinionGroups: [
    { id: "group-a", synthetic: true, label: "Group A" },
    { id: "group-b", synthetic: true, label: "Group B" },
    { id: "group-c", synthetic: true, label: "Group C" },
  ],
  consultationResults: [
    {
      id: "consult-cedar-river-2026-03",
      topicId: "topic-cedar-river-drought-surcharge",
      synthetic: true,
      participationCount: 1240,
      responseCoverage: 0.72,
      opinionGroupIds: ["group-a", "group-b", "group-c"],
      statementIds: [
        "stmt-publish-thresholds",
        "stmt-protect-indoor-essential",
        "stmt-flat-fee-simpler",
        "stmt-no-price-tools",
        "stmt-device-subsidies-popular",
        "stmt-audit-before-fee",
        "stmt-hardship-rebate",
        "stmt-sunset-clause",
      ],
      consensusStatementIds: [
        "stmt-publish-thresholds",
        "stmt-protect-indoor-essential",
      ],
      highDisagreementStatementIds: [
        "stmt-flat-fee-simpler",
        "stmt-no-price-tools",
      ],
      statementMetrics: [
        {
          statementId: "stmt-publish-thresholds",
          agreeShare: 0.86,
          groupAgreeShares: {
            "group-a": 0.84,
            "group-b": 0.88,
            "group-c": 0.85,
          },
        },
        {
          statementId: "stmt-protect-indoor-essential",
          agreeShare: 0.81,
          groupAgreeShares: {
            "group-a": 0.79,
            "group-b": 0.83,
            "group-c": 0.8,
          },
        },
        {
          statementId: "stmt-flat-fee-simpler",
          agreeShare: 0.48,
          groupAgreeShares: {
            "group-a": 0.72,
            "group-b": 0.31,
            "group-c": 0.4,
          },
        },
        {
          statementId: "stmt-no-price-tools",
          agreeShare: 0.41,
          groupAgreeShares: {
            "group-a": 0.22,
            "group-b": 0.35,
            "group-c": 0.68,
          },
        },
        {
          statementId: "stmt-device-subsidies-popular",
          agreeShare: 0.77,
          groupAgreeShares: {
            "group-a": 0.74,
            "group-b": 0.8,
            "group-c": 0.76,
          },
        },
        {
          statementId: "stmt-audit-before-fee",
          agreeShare: 0.39,
          groupAgreeShares: {
            "group-a": 0.42,
            "group-b": 0.37,
            "group-c": 0.38,
          },
        },
        {
          statementId: "stmt-hardship-rebate",
          agreeShare: 0.69,
          groupAgreeShares: {
            "group-a": 0.7,
            "group-b": 0.66,
            "group-c": 0.71,
          },
        },
        {
          statementId: "stmt-sunset-clause",
          agreeShare: 0.64,
          groupAgreeShares: {
            "group-a": 0.61,
            "group-b": 0.67,
            "group-c": 0.63,
          },
        },
      ],
      methodVersion: "consultation-mock-map@0.1.0",
      notRepresentativeNotice:
        "Displayed participants are synthetic and are not a representative sample of any real population.",
    },
  ],
  agendaItems: [
    {
      id: "agenda-cedar-river-drought-surcharge",
      slug: "cedar-river-drought-surcharge",
      topicId: "topic-cedar-river-drought-surcharge",
      consultationResultId: "consult-cedar-river-2026-03",
      synthetic: true,
      state: "qualified",
      title: "Qualify graduated drought-surcharge question for deliberation",
      thresholds: [
        {
          id: "th-participation",
          label: "Participation coverage",
          required: "≥ 60% statement response coverage",
          actual: "72%",
          met: true,
        },
        {
          id: "th-cross-group",
          label: "Cross-group support on procedural statements",
          required: "≥ 2 consensus statements across Groups A–C",
          actual: "2 consensus statements",
          met: true,
        },
        {
          id: "th-disagreement",
          label: "Disagreement / salience present",
          required: "≥ 1 high-disagreement statement retained for deliberation",
          actual: "2 high-disagreement statements",
          met: true,
        },
        {
          id: "th-evidence",
          label: "Evidence readiness",
          required: "≥ 3 accepted or limited sources; no reliance on rejected sources",
          actual: "3 accepted, 2 limited, 1 pending, 1 disputed, 1 rejected",
          met: true,
        },
      ],
      participationCoverage: "72% average statement response coverage (synthetic).",
      crossGroupSupport:
        "Two procedural statements show agreement across Groups A, B, and C.",
      disagreementSalience:
        "Flat-fee versus no-price-tool statements remain high disagreement.",
      evidenceReadiness:
        "Core storage and elasticity sources accepted; billing ops estimate still pending.",
      representationWarning:
        "Synthetic cohort is not a population sample; representation diagnostics are illustrative only.",
      methodVersion: "agenda-threshold-trace@0.1.0",
      calculationTrace: [
        "Loaded consultation snapshot consult-cedar-river-2026-03.",
        "Counted consensus statements with agreeShare ≥ 0.75 in all groups: 2.",
        "Counted high-disagreement statements with inter-group range ≥ 0.35: 2.",
        "Checked evidence statuses linked to active claims; rejected vendor whitepaper excluded from readiness numerator.",
        "Default recommendation: qualify for deliberation.",
      ],
      sensitivityNote:
        "If the cross-group consensus rule required three statements instead of two, this item would fall to human deferral under the same synthetic inputs.",
      humanReview: {
        reviewerRole: "Agenda steward (synthetic)",
        decision: "qualified",
        decidedAt: "2026-03-18",
        conflicts: "None disclosed in the synthetic record.",
        rationale:
          "Qualified despite a pending billing-ops estimate because rejected vendor claims were excluded and an evidence request can be issued in deliberation. Popularity of device subsidies was not treated as evidence quality.",
      },
    },
    {
      id: "agenda-cedar-river-hardship-rebate-scope",
      slug: "cedar-river-hardship-rebate-scope",
      topicId: "topic-cedar-river-drought-surcharge",
      consultationResultId: "consult-cedar-river-2026-03",
      synthetic: true,
      state: "proposed",
      title: "Propose hardship-rebate scope as a separate agenda item",
      thresholds: [
        {
          id: "th-hardship-participation",
          label: "Participation coverage",
          required: "≥ 60% statement response coverage",
          actual: "72%",
          met: true,
        },
        {
          id: "th-hardship-cross-group",
          label: "Cross-group support on procedural statements",
          required: "≥ 2 consensus statements across Groups A–C",
          actual: "2 consensus statements",
          met: true,
        },
        {
          id: "th-hardship-disagreement",
          label: "Disagreement / salience present",
          required: "≥ 1 high-disagreement statement retained for deliberation",
          actual: "Hardship rebate is mid-support, not high disagreement",
          met: false,
        },
        {
          id: "th-hardship-evidence",
          label: "Evidence readiness",
          required: "≥ 3 accepted or limited sources; no reliance on rejected sources",
          actual: "Equity memo accepted; billing ops estimate still pending",
          met: false,
        },
      ],
      participationCoverage: "72% average statement response coverage (synthetic).",
      crossGroupSupport:
        "Consultation snapshot shows procedural consensus elsewhere; hardship rebate itself is not a consensus statement.",
      disagreementSalience:
        "Hardship rebate is moderately popular but is not one of the high-disagreement anchors.",
      evidenceReadiness:
        "Equity impact memo is accepted; operational cost estimate remains pending.",
      representationWarning:
        "Synthetic cohort is not a population sample; representation diagnostics are illustrative only.",
      methodVersion: "agenda-threshold-trace@0.1.0",
      calculationTrace: [
        "Loaded consultation snapshot consult-cedar-river-2026-03.",
        "Scoped question: whether hardship-rebate design should be a separate agenda item.",
        "Salience gate failed: statement is not in the high-disagreement set.",
        "Evidence readiness incomplete while billing-ops estimate is pending.",
        "Default recommendation: remain proposed pending human review.",
      ],
      sensitivityNote:
        "If the salience gate accepted mid-support statements, this item could move to human review for qualification instead of staying proposed.",
      humanReview: {
        reviewerRole: "Agenda steward (synthetic)",
        decision: "proposed",
        decidedAt: "2026-03-17",
        conflicts: "None disclosed in the synthetic record.",
        rationale:
          "Left in proposed state. Popularity of the hardship-rebate statement is noted but does not by itself open a separate agenda lane while salience and evidence-readiness gates remain unmet.",
      },
    },
    {
      id: "agenda-cedar-river-billing-ops-gap",
      slug: "cedar-river-billing-ops-gap",
      topicId: "topic-cedar-river-drought-surcharge",
      consultationResultId: "consult-cedar-river-2026-03",
      synthetic: true,
      state: "deferred",
      title: "Defer billing-operations readiness as a blocking evidence concern",
      thresholds: [
        {
          id: "th-billing-participation",
          label: "Participation coverage",
          required: "≥ 60% statement response coverage",
          actual: "72%",
          met: true,
        },
        {
          id: "th-billing-cross-group",
          label: "Cross-group support on procedural statements",
          required: "≥ 2 consensus statements across Groups A–C",
          actual: "2 consensus statements",
          met: true,
        },
        {
          id: "th-billing-disagreement",
          label: "Disagreement / salience present",
          required: "≥ 1 high-disagreement statement retained for deliberation",
          actual: "2 high-disagreement statements",
          met: true,
        },
        {
          id: "th-billing-evidence",
          label: "Evidence readiness",
          required: "Accepted estimate of billing-system change cost before qualification",
          actual: "Billing ops estimate still pending",
          met: false,
        },
      ],
      participationCoverage: "72% average statement response coverage (synthetic).",
      crossGroupSupport:
        "Procedural consensus exists, but this lane is about evidence readiness, not preference.",
      disagreementSalience:
        "Policy disagreement remains; deferral is about missing operations evidence.",
      evidenceReadiness:
        "Billing-system change-cost estimate is pending; readiness gate fails for this scoped item.",
      representationWarning:
        "Synthetic cohort is not a population sample; representation diagnostics are illustrative only.",
      methodVersion: "agenda-threshold-trace@0.1.0",
      calculationTrace: [
        "Loaded consultation snapshot consult-cedar-river-2026-03.",
        "Preference and salience gates met for the broader surcharge question.",
        "Scoped evidence gate failed: required billing-ops estimate is pending.",
        "Default recommendation: defer rather than qualify this scoped readiness item.",
      ],
      sensitivityNote:
        "If the pending billing-ops estimate were accepted with limitations, the default recommendation would flip to qualify under the same preference inputs.",
      humanReview: {
        reviewerRole: "Agenda steward (synthetic)",
        decision: "deferred",
        decidedAt: "2026-03-18",
        conflicts: "None disclosed in the synthetic record.",
        rationale:
          "Deferred. The reviewer did not override the failed evidence-readiness gate. Preference support is visible but is not treated as a substitute for the missing billing-ops estimate.",
      },
    },
    {
      id: "agenda-cedar-river-device-subsidy-framing",
      slug: "cedar-river-device-subsidy-framing",
      topicId: "topic-cedar-river-drought-surcharge",
      consultationResultId: "consult-cedar-river-2026-03",
      synthetic: true,
      state: "rejected",
      title: "Reject device-subsidy framing that relies on rejected evidence",
      thresholds: [
        {
          id: "th-device-participation",
          label: "Participation coverage",
          required: "≥ 60% statement response coverage",
          actual: "72%",
          met: true,
        },
        {
          id: "th-device-cross-group",
          label: "Cross-group support on procedural statements",
          required: "≥ 2 consensus statements across Groups A–C",
          actual: "Device-subsidy statement is popular but not a consensus statement",
          met: false,
        },
        {
          id: "th-device-disagreement",
          label: "Disagreement / salience present",
          required: "≥ 1 high-disagreement statement retained for deliberation",
          actual: "Device-subsidy statement is not in the high-disagreement set",
          met: false,
        },
        {
          id: "th-device-evidence",
          label: "Evidence readiness",
          required: "≥ 3 accepted or limited sources; no reliance on rejected sources",
          actual: "Primary linked source is a rejected vendor whitepaper",
          met: false,
        },
      ],
      participationCoverage: "72% average statement response coverage (synthetic).",
      crossGroupSupport:
        "High local popularity on the device-subsidy statement is not cross-group consensus.",
      disagreementSalience:
        "The statement is popular/weak-evidence, not a high-disagreement deliberation anchor.",
      evidenceReadiness:
        "Linked vendor whitepaper is rejected; readiness fails when that source would be required.",
      representationWarning:
        "Synthetic cohort is not a population sample; representation diagnostics are illustrative only.",
      methodVersion: "agenda-threshold-trace@0.1.0",
      calculationTrace: [
        "Loaded consultation snapshot consult-cedar-river-2026-03.",
        "Measured agree share on device-subsidy statement: high popularity.",
        "Cross-group consensus gate failed for this framing.",
        "Evidence readiness failed because the linked vendor whitepaper is rejected.",
        "Default recommendation: reject agenda qualification for this framing.",
      ],
      sensitivityNote:
        "Raising the popularity weight would still not qualify this item while the evidence gate excludes rejected sources.",
      humanReview: {
        reviewerRole: "Agenda steward (synthetic)",
        decision: "rejected",
        decidedAt: "2026-03-18",
        conflicts: "None disclosed in the synthetic record.",
        rationale:
          "Rejected. Popularity alone does not place the device-subsidy framing on the agenda when consensus and evidence-readiness gates fail and the linked source is rejected.",
      },
    },
  ],
  proposals: [
    {
      id: "proposal-cedar-v1",
      synthetic: true,
      topicId: "topic-cedar-river-drought-surcharge",
      version: 1,
      state: "draft",
      title: "Adopt a three-stage residential drought surcharge",
      body: "Draft v1 proposes Stage 1–3 surcharges on residential tiers above an essential indoor allotment, with publication of thresholds ten days before activation.",
      createdAt: "2026-03-25",
    },
    {
      id: "proposal-cedar-v2",
      synthetic: true,
      topicId: "topic-cedar-river-drought-surcharge",
      version: 2,
      state: "under_amendment",
      title: "Adopt a three-stage residential drought surcharge with hardship rebate",
      body: "Draft v2 keeps graduated stages, adds a hardship rebate path, and requires a conservation audit summary at activation.",
      createdAt: "2026-04-08",
    },
    {
      id: "proposal-cedar-v3",
      synthetic: true,
      topicId: "topic-cedar-river-drought-surcharge",
      version: 3,
      state: "recommended",
      title:
        "Adopt a three-stage residential drought surcharge with hardship rebate and sunset review",
      body: "Final text recommends graduated stages, hardship rebate, audit summary at activation, and a mandatory review date. Flat emergency fee and voluntary-only alternatives are not recommended. Governing-board authority remains unresolved.",
      createdAt: "2026-04-20",
    },
  ],
  amendments: [
    {
      id: "amend-hardship-rebate",
      synthetic: true,
      proposalId: "proposal-cedar-v1",
      status: "accepted",
      title: "Add hardship rebate path",
      rationale:
        "Responds to equity vignettes without treating them as a full incidence study.",
      body: "Insert a published hardship rebate application path for qualifying residential accounts.",
      createdAt: "2026-04-02",
    },
    {
      id: "amend-sunset-review",
      synthetic: true,
      proposalId: "proposal-cedar-v2",
      status: "accepted",
      title: "Add sunset review date",
      rationale:
        "Matches consultation interest in re-authorization and keeps the surcharge temporary unless renewed.",
      body: "Require public review on or before the stated review date; surcharge authority lapses without re-adoption.",
      createdAt: "2026-04-12",
    },
  ],
  councilParticipants: [
    {
      id: "council-ada-nguyen",
      synthetic: true,
      displayName: "Ada Nguyen",
      termStart: "2026-01-01",
      termEnd: "2027-12-31",
      selectionPath: "Synthetic stratified draw from consultation pool A",
      voting: true,
    },
    {
      id: "council-ben-okonkwo",
      synthetic: true,
      displayName: "Ben Okonkwo",
      termStart: "2026-01-01",
      termEnd: "2027-12-31",
      selectionPath: "Synthetic stratified draw from consultation pool B",
      voting: true,
    },
    {
      id: "council-cara-diaz",
      synthetic: true,
      displayName: "Cara Diaz",
      termStart: "2026-01-01",
      termEnd: "2027-12-31",
      selectionPath: "Synthetic stratified draw from consultation pool C",
      voting: true,
    },
    {
      id: "council-devon-park",
      synthetic: true,
      displayName: "Devon Park",
      termStart: "2026-01-01",
      termEnd: "2027-12-31",
      selectionPath:
        "Synthetic facilitation seat — present in deliberation, nonvoting, and omitted from the roll-call tally",
      voting: false,
    },
    {
      id: "council-elena-frost",
      synthetic: true,
      displayName: "Elena Frost",
      termStart: "2026-01-01",
      termEnd: "2027-12-31",
      selectionPath: "Synthetic stratified draw from consultation pool A",
      voting: true,
    },
  ],
  conflictDisclosures: [
    {
      id: "conflict-ben-irrigation",
      synthetic: true,
      participantId: "council-ben-okonkwo",
      summary:
        "Household holds a minority stake in a fictional irrigation-supply cooperative outside the district.",
      disclosedAt: "2026-03-20",
    },
    {
      id: "conflict-elena-foundation",
      synthetic: true,
      participantId: "council-elena-frost",
      summary:
        "Serves unpaid on the advisory circle of a fictional watershed education nonprofit.",
      disclosedAt: "2026-03-21",
    },
  ],
  deliberations: [
    {
      id: "delib-cedar-river-drought-surcharge",
      slug: "cedar-river-drought-surcharge",
      topicId: "topic-cedar-river-drought-surcharge",
      agendaItemId: "agenda-cedar-river-drought-surcharge",
      synthetic: true,
      selectionExplanation:
        "The synthetic deliberation council was drawn with capacity limits and short terms from neutrally labeled consultation pools. Selection is illustrative only and does not assert statistical representation.",
      participantIds: [
        "council-ada-nguyen",
        "council-ben-okonkwo",
        "council-cara-diaz",
        "council-devon-park",
        "council-elena-frost",
      ],
      conflictDisclosureIds: [
        "conflict-ben-irrigation",
        "conflict-elena-foundation",
      ],
      proposalIds: [
        "proposal-cedar-v1",
        "proposal-cedar-v2",
        "proposal-cedar-v3",
      ],
      amendmentIds: ["amend-hardship-rebate", "amend-sunset-review"],
      evidenceRequest: {
        id: "ereq-billing-ops",
        request:
          "Provide a revised billing-configuration estimate for a three-stage surcharge table.",
        response:
          "Synthetic staff response: stage table requires about 120 additional configuration hours versus a flat fee; still lower than a full tariff redesign.",
        requestedAt: "2026-04-03",
        respondedAt: "2026-04-07",
        relatedEvidenceIds: [
          "evidence-billing-ops-brief",
          "evidence-basin-storage-note",
          "evidence-equity-impact-memo",
        ],
      },
      recusal: {
        participantId: "council-ben-okonkwo",
        publicReason:
          "Recused from the final vote because of a disclosed household financial interest in an irrigation-supply cooperative. Private financial details are not published.",
        recordedAt: "2026-04-18",
      },
      timeline: [
        {
          at: "2026-03-25",
          summary: "Draft proposal v1 introduced.",
        },
        {
          at: "2026-04-02",
          summary: "Hardship rebate amendment proposed.",
        },
        {
          at: "2026-04-03",
          summary: "Evidence request issued on billing configuration.",
        },
        {
          at: "2026-04-12",
          summary: "Sunset review amendment proposed.",
        },
        {
          at: "2026-04-18",
          summary: "Recusal recorded; final vote scheduled.",
        },
        {
          at: "2026-04-18",
          summary:
            "Facilitation seat (Devon Park) confirmed nonvoting and excluded from the roll-call tally.",
        },
      ],
      observerNotice:
        "Public observation of this synthetic deliberation does not confer participation rights. Closed means capacity-limited participation, not secret institutional action. Facilitation seats may appear in the participant list without casting a counted vote.",
      publicRedaction: {
        scope:
          "A facilitation scheduling note that originally included a private contact channel",
        publicReason:
          "Personal contact details are omitted. Public observation needs the scheduling step itself, not private contact information. Broader redaction policy remains unresolved; see open questions.",
      },
    },
  ],
  decisions: [
    {
      id: "decision-cedar-river-drought-surcharge",
      slug: "cedar-river-drought-surcharge",
      topicId: "topic-cedar-river-drought-surcharge",
      deliberationId: "delib-cedar-river-drought-surcharge",
      finalProposalId: "proposal-cedar-v3",
      synthetic: true,
      outcome: "recommended",
      adoptingBody:
        "Synthetic Policy Council — recommendation only (governing-board authority pending counsel; not a final legal adoption).",
      publishedOn: "2026-04-22",
      recommendedOn: "2026-04-22",
      reviewOn: "2027-05-01",
      voteFor: 2,
      voteAgainst: 1,
      voteAbstain: 0,
      rollCall: [
        { participantId: "council-ada-nguyen", vote: "for" },
        { participantId: "council-ben-okonkwo", vote: "recused" },
        { participantId: "council-cara-diaz", vote: "for" },
        { participantId: "council-elena-frost", vote: "against" },
      ],
      rationale:
        "The Policy Council recommended a graduated surcharge with hardship rebate and sunset review. Cross-group consensus supported publication of thresholds and protection of essential indoor use. Device-subsidy popularity was not treated as proof. The pending billing estimate was answered by an evidence request rather than by deferring indefinitely.",
      minorityReport: {
        title: "Minority report — prefer voluntary-first extension",
        authorParticipantIds: ["council-elena-frost"],
        body: "The minority would have extended voluntary measures for one additional season and required a completed equity incidence study before any surcharge. The minority agrees thresholds should be public if a price tool is used later.",
      },
      proposalVersionIds: [
        "proposal-cedar-v1",
        "proposal-cedar-v2",
        "proposal-cedar-v3",
      ],
    },
  ],
  auditEvents: [
    {
      id: "audit-topic-opened",
      at: "2026-01-12",
      actorRole: "topic-editor (synthetic)",
      action: "topic.opened",
      subjectType: "topic",
      subjectId: "topic-cedar-river-drought-surcharge",
      summary: "Synthetic topic brief published.",
      synthetic: true,
    },
    {
      id: "audit-consult-closed",
      at: "2026-03-01",
      actorRole: "consultation-steward (synthetic)",
      action: "consultation.closed",
      subjectType: "consultationResult",
      subjectId: "consult-cedar-river-2026-03",
      summary: "Synthetic consultation snapshot sealed for agenda calculation.",
      synthetic: true,
    },
    {
      id: "audit-agenda-qualified",
      at: "2026-03-18",
      actorRole: "agenda-steward (synthetic)",
      action: "agenda.qualified",
      subjectType: "agendaItem",
      subjectId: "agenda-cedar-river-drought-surcharge",
      summary: "Human review qualified the item with published rationale.",
      synthetic: true,
    },
    {
      id: "audit-decision-recommended",
      at: "2026-04-22",
      actorRole: "policy-council-clerk (synthetic)",
      action: "decision.recommended",
      subjectType: "decision",
      subjectId: "decision-cedar-river-drought-surcharge",
      summary: "Policy Council recommendation published with minority report and review date; board authority unresolved.",
      synthetic: true,
    },
  ],
} satisfies FixtureCatalog;
