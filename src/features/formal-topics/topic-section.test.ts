import { describe, expect, it } from "vitest";

import {
  normalizeLegacyTopicView,
  parseTopicSection,
  topicSectionHref,
} from "@/features/formal-topics/topic-section";

describe("topic section query parsing", () => {
  it("defaults omitted and empty values to overview", () => {
    expect(parseTopicSection(undefined)).toBe("overview");
    expect(parseTopicSection("")).toBe("overview");
  });

  it("accepts allowlisted sections only", () => {
    expect(parseTopicSection("overview")).toBe("overview");
    expect(parseTopicSection("evidence")).toBe("evidence");
    expect(parseTopicSection("discussions")).toBe("discussions");
  });

  it("falls back for unknown, repeated, malformed, or overlong values", () => {
    expect(parseTopicSection("not-a-section")).toBe("overview");
    expect(parseTopicSection(["evidence", "discussions"])).toBe("evidence");
    expect(parseTopicSection("evidence&evil=1")).toBe("overview");
    expect(parseTopicSection("x".repeat(64))).toBe("overview");
  });

  it("builds shareable hrefs without free-text query values", () => {
    expect(topicSectionHref("cedar-river-drought-surcharge", "overview")).toBe(
      "/formal-topics/cedar-river-drought-surcharge",
    );
    expect(topicSectionHref("cedar-river-drought-surcharge", "evidence")).toBe(
      "/formal-topics/cedar-river-drought-surcharge?section=evidence",
    );
  });

  it("normalizes legacy public-input-report view to overview", () => {
    expect(normalizeLegacyTopicView("public-input-report")).toEqual({
      section: "overview",
      hash: "public-input-report",
    });
  });
});
