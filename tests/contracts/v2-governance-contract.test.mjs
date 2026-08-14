import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const contractUrl = new URL(
  "../../docs/v2/governance-state-machine.json",
  import.meta.url,
);

async function loadContract() {
  return JSON.parse(await readFile(contractUrl, "utf8"));
}

async function readRepoFile(relativePath) {
  return readFile(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}

test("v2 governance contract is internally referentially complete", async () => {
  const contract = await loadContract();
  const ids = contract.states.map((state) => state.id);
  const idSet = new Set(ids);

  assert.equal(contract.schemaVersion, "commonhall-governance@2.0.0");
  assert.equal(idSet.size, ids.length, "state IDs must be unique");
  assert.ok(ids.length >= 15, "the lifecycle must not collapse distinct decisions");

  for (const transition of contract.transitions) {
    assert.ok(idSet.has(transition.from), `unknown from state: ${transition.from}`);
    assert.ok(idSet.has(transition.to), `unknown to state: ${transition.to}`);
    assert.notEqual(transition.from, transition.to, transition.action);
  }
});

test("no proposal can bypass qualification and consultation", async () => {
  const contract = await loadContract();
  const forbiddenDestinations = new Set([
    "chamber_queued",
    "chamber_deliberating",
    "council_scheduled",
    "council_deliberating",
    "recommendations_published",
  ]);

  const bypass = contract.transitions.find(
    (transition) =>
      ["informal_draft", "formal_review_pending"].includes(transition.from) &&
      forbiddenDestinations.has(transition.to),
  );

  assert.equal(bypass, undefined);
  assert.ok(
    contract.transitions.some(
      ({ from, to }) =>
        from === "formal_review_pending" && to === "qualified_consultation",
    ),
  );
});

test("only community-accepted topics enter the Chamber automatically", async () => {
  const contract = await loadContract();
  const chamberEntries = contract.transitions.filter(
    ({ to }) => to === "chamber_queued",
  );

  assert.deepEqual(
    chamberEntries.map(({ from }) => from),
    ["community_accepted"],
  );
});

test("Council departures from an accepted Chamber verdict require reasons", async () => {
  const contract = await loadContract();
  const decline = contract.transitions.find(
    ({ action }) => action === "decline_council_intake",
  );
  const disputedOverride = contract.transitions.find(
    ({ action }) => action === "accept_disputed_to_council_agenda",
  );

  assert.equal(decline?.reasonRequired, true);
  assert.equal(disputedOverride?.reasonRequired, true);
});

test("public agenda residency and Council transfer are explicit", async () => {
  const contract = await loadContract();
  const states = new Map(contract.states.map((state) => [state.id, state]));

  for (const id of [
    "qualified_consultation",
    "community_accepted",
    "community_disputed",
    "consultation_inconclusive",
    "chamber_queued",
    "chamber_deliberating",
    "chamber_accepted",
    "chamber_disputed",
    "council_declined",
  ]) {
    assert.equal(states.get(id)?.publicAgenda, true, `${id} must remain public`);
  }

  for (const id of [
    "council_scheduled",
    "council_deliberating",
    "recommendations_published",
  ]) {
    assert.equal(states.get(id)?.publicAgenda, false, `${id} left Public Agenda`);
  }
});

test("honorable and dishonorable disqualification remain different", async () => {
  const contract = await loadContract();
  const states = new Map(contract.states.map((state) => [state.id, state]));
  const honorable = states.get("honorably_disqualified");
  const dishonorable = states.get("dishonorably_disqualified");

  assert.equal(honorable?.realm, "commons_informal");
  assert.equal(honorable?.public, true);
  assert.equal(dishonorable?.realm, "protected_audit");
  assert.equal(dishonorable?.public, false);
  assert.equal(honorable?.deadTopic, true);
  assert.equal(dishonorable?.deadTopic, true);
  assert.equal(honorable?.newConsultationRequiredForSuccessor, true);
  assert.equal(dishonorable?.newConsultationRequiredForSuccessor, true);
});

test("consultation publications exclude people and raw responses", async () => {
  const contract = await loadContract();

  assert.equal(contract.rawConsultationDataPublic, false);
  assert.equal(contract.individualConsultationRecordsPublic, false);
  assert.match(contract.consultationMapPolicy, /aggregate geometry only/i);
  assert.match(contract.consultationMapPolicy, /no person-level points/i);
});

test("the public institutional roll call includes abstention and recusal", async () => {
  const contract = await loadContract();
  const positions = new Set(contract.publicRollCall.allowedMemberPositions);

  for (const position of ["yes", "no", "abstain", "recused", "absent"]) {
    assert.ok(positions.has(position));
  }
});

test("canonical v2 documents and stable charter path exist", async () => {
  const required = [
    "docs/product-charter.md",
    "docs/v2/product-charter.md",
    "docs/v2/governance-lifecycle.md",
    "docs/v2/community-standards.md",
    "docs/v2/architecture.md",
    "docs/v2/testing-strategy.md",
    "docs/v2/ci-pr-workflow.md",
    "docs/v2/open-decisions.md",
    "docs/v2/implementation-plan.md",
    "docs/v2/cursor-cloud-agent-prompt.md",
    "docs/v2/final_overview.md",
    "docs/decisions/0022-commonhall-v2-reset.md",
  ];

  const contents = await Promise.all(required.map(readRepoFile));
  for (let index = 0; index < required.length; index += 1) {
    assert.ok(contents[index].trim().length > 80, `${required[index]} is empty`);
  }

  assert.match(contents[0], /active charter/i);
  assert.match(
    contents[required.indexOf("docs/v2/final_overview.md")],
    /not production-ready/i,
  );
  assert.match(contents.at(-1), /supersedes phase 1–4 product scope/i);
});

test("implementation handoff defines exactly six sequential phase sections", async () => {
  const plan = await readRepoFile("docs/v2/implementation-plan.md");
  const prompt = await readRepoFile("docs/v2/cursor-cloud-agent-prompt.md");
  const phases = [...plan.matchAll(/^## Phase (\d) —/gm)].map((match) =>
    Number(match[1]),
  );

  assert.deepEqual(phases, [1, 2, 3, 4, 5, 6]);
  assert.match(prompt, /one dedicated subagent for this phase/i);
  assert.match(prompt, /more detailed Phase \[N\] plan/i);
  assert.match(prompt, /draft PR to `main`/i);
  assert.match(prompt, /CI \/ required/);
});

test("terminal topics cannot transition or reuse a consultation", async () => {
  const contract = await loadContract();
  const terminalIds = new Set(
    contract.states.filter((state) => state.terminal).map((state) => state.id),
  );

  for (const terminalId of terminalIds) {
    assert.equal(
      contract.transitions.some(({ from }) => from === terminalId),
      false,
      `${terminalId} must not have an outgoing transition`,
    );
  }

  for (const state of contract.states.filter((candidate) => candidate.deadTopic)) {
    assert.equal(state.newConsultationRequiredForSuccessor, true);
  }
});
