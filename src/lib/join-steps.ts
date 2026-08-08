export type JoinStep = {
  id: string;
  title: string;
  summary: string;
  clarifies?: string;
};

export const joinSteps: JoinStep[] = [
  {
    id: "eligibility",
    title: "Eligibility",
    summary:
      "Preview of geographic and age eligibility for community participation. Initial jurisdiction intent is Tennessee-first with possible later expansion.",
    clarifies:
      "Eligibility rules are not finalized and are not a claim of current legal enrollment.",
  },
  {
    id: "bot-resistance",
    title: "Bot resistance",
    summary:
      "Automated abuse checks intended to make mass fake accounts harder. This is about scripted traffic and fraud patterns, not about reading someone’s politics.",
    clarifies:
      "Bot detection is not the same as proving a unique person or collecting government ID.",
  },
  {
    id: "account-continuity",
    title: "Account continuity",
    summary:
      "A way for the same person to return to the same account over time so participation history can be versioned and audited without public identity exposure.",
    clarifies:
      "Continuity is not uniqueness proof and is not legal identity verification.",
  },
  {
    id: "uniqueness",
    title: "Uniqueness (later / higher assurance)",
    summary:
      "Checks aimed at one-person-one-account risk for higher-impact roles. Methods are unresolved and may not require government documents.",
    clarifies:
      "The prototype does not imply that identification documents will necessarily be required.",
  },
  {
    id: "conduct",
    title: "Conduct assent",
    summary:
      "Placeholder summary of expected participation conduct and behavior-based enforcement. Viewpoint-neutral: enforcement targets harmful behavior, not ideology labels.",
    clarifies: "Not legally reviewed.",
  },
  {
    id: "privacy",
    title: "Privacy consent",
    summary:
      "Placeholder summary of what may be public versus protected, including that granular political-opinion histories and verification artifacts are not public by default.",
    clarifies: "Not legally reviewed.",
  },
  {
    id: "higher-impact",
    title: "Stronger verification for higher-impact roles",
    summary:
      "Council and steward roles may require additional assurance steps beyond open consultation participation. Exact ladder remains unresolved.",
    clarifies:
      "Legal identity may be considered for some roles later; it is not assumed for every community participant.",
  },
];

export const conductPlaceholder = {
  title: "Conduct commitments (placeholder)",
  status: "Not legally reviewed",
  body: "Participants would agree to engage without harassment, doxxing, or coordinated deception; to disclose relevant conflicts when acting in higher-impact roles; and to accept behavior-based moderation with a published appeal path. This text is a demonstration placeholder only.",
};

export const privacyPlaceholder = {
  title: "Privacy commitments (placeholder)",
  status: "Not legally reviewed",
  body: "The project intends an open-by-default approach to institutional records and a protected-by-necessity approach to personal data, verification artifacts, and granular opinion histories. Retention, deletion, and legal bases are unresolved. This text is a demonstration placeholder only.",
};
