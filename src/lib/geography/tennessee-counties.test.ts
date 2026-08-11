import { describe, expect, it } from "vitest";

import {
  TENNESSEE_COUNTIES,
  TENNESSEE_STATE_CODE,
  formatTopicGeography,
  getTennesseeCountyByFips,
  isTennesseeCountyFips,
  validateTopicGeography,
} from "@/lib/geography/tennessee-counties";

describe("Tennessee county reference", () => {
  it("lists exactly 95 unique FIPS and names", () => {
    expect(TENNESSEE_COUNTIES).toHaveLength(95);
    const fips = TENNESSEE_COUNTIES.map((c) => c.fips);
    const names = TENNESSEE_COUNTIES.map((c) => c.name);
    expect(new Set(fips).size).toBe(95);
    expect(new Set(names).size).toBe(95);
    expect(fips.every((value) => /^47\d{3}$/.test(value))).toBe(true);
  });

  it("looks up and rejects unknown FIPS", () => {
    expect(isTennesseeCountyFips("47037")).toBe(true);
    expect(getTennesseeCountyByFips("47037")?.name).toBe("Davidson");
    expect(isTennesseeCountyFips("99999")).toBe(false);
    expect(getTennesseeCountyByFips("06037")).toBeNull();
  });

  it("validates statewide vs county invariants", () => {
    expect(
      validateTopicGeography({
        jurisdictionLevel: "statewide",
        stateCode: "TN",
      }),
    ).toEqual({
      ok: true,
      value: {
        jurisdictionLevel: "statewide",
        stateCode: TENNESSEE_STATE_CODE,
        countyFips: null,
      },
    });
    expect(
      validateTopicGeography({
        jurisdictionLevel: "statewide",
        countyFips: "47037",
      }).ok,
    ).toBe(false);
    expect(
      validateTopicGeography({
        jurisdictionLevel: "county",
        countyFips: "47037",
      }).ok,
    ).toBe(true);
    expect(
      validateTopicGeography({
        jurisdictionLevel: "county",
        stateCode: "KY",
        countyFips: "47037",
      }).ok,
    ).toBe(false);
    expect(
      validateTopicGeography({
        jurisdictionLevel: "county",
        countyFips: "99999",
      }).ok,
    ).toBe(false);
  });

  it("formats geography labels without implying eligibility", () => {
    expect(
      formatTopicGeography({
        jurisdictionLevel: "statewide",
        stateCode: "TN",
        countyFips: null,
      }),
    ).toBe("Tennessee statewide");
    expect(
      formatTopicGeography({
        jurisdictionLevel: "county",
        stateCode: "TN",
        countyFips: "47157",
      }),
    ).toBe("Shelby County");
  });
});
