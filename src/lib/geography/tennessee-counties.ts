/**
 * Checked-in Tennessee county reference (all 95 counties).
 * Geography is topic classification only — not eligibility, residency, or voting.
 * FIPS are five-digit strings (state 47 + three-digit county).
 */

export type TennesseeCounty = {
  /** Five-digit FIPS, e.g. "47037" */
  fips: string;
  name: string;
};

export const TENNESSEE_STATE_CODE = "TN" as const;

/** Official-order list of all 95 Tennessee counties. */
export const TENNESSEE_COUNTIES: readonly TennesseeCounty[] = [
  { fips: "47001", name: "Anderson" },
  { fips: "47003", name: "Bedford" },
  { fips: "47005", name: "Benton" },
  { fips: "47007", name: "Bledsoe" },
  { fips: "47009", name: "Blount" },
  { fips: "47011", name: "Bradley" },
  { fips: "47013", name: "Campbell" },
  { fips: "47015", name: "Cannon" },
  { fips: "47017", name: "Carroll" },
  { fips: "47019", name: "Carter" },
  { fips: "47021", name: "Cheatham" },
  { fips: "47023", name: "Chester" },
  { fips: "47025", name: "Claiborne" },
  { fips: "47027", name: "Clay" },
  { fips: "47029", name: "Cocke" },
  { fips: "47031", name: "Coffee" },
  { fips: "47033", name: "Crockett" },
  { fips: "47035", name: "Cumberland" },
  { fips: "47037", name: "Davidson" },
  { fips: "47039", name: "Decatur" },
  { fips: "47041", name: "DeKalb" },
  { fips: "47043", name: "Dickson" },
  { fips: "47045", name: "Dyer" },
  { fips: "47047", name: "Fayette" },
  { fips: "47049", name: "Fentress" },
  { fips: "47051", name: "Franklin" },
  { fips: "47053", name: "Gibson" },
  { fips: "47055", name: "Giles" },
  { fips: "47057", name: "Grainger" },
  { fips: "47059", name: "Greene" },
  { fips: "47061", name: "Grundy" },
  { fips: "47063", name: "Hamblen" },
  { fips: "47065", name: "Hamilton" },
  { fips: "47067", name: "Hancock" },
  { fips: "47069", name: "Hardeman" },
  { fips: "47071", name: "Hardin" },
  { fips: "47073", name: "Hawkins" },
  { fips: "47075", name: "Haywood" },
  { fips: "47077", name: "Henderson" },
  { fips: "47079", name: "Henry" },
  { fips: "47081", name: "Hickman" },
  { fips: "47083", name: "Houston" },
  { fips: "47085", name: "Humphreys" },
  { fips: "47087", name: "Jackson" },
  { fips: "47089", name: "Jefferson" },
  { fips: "47091", name: "Johnson" },
  { fips: "47093", name: "Knox" },
  { fips: "47095", name: "Lake" },
  { fips: "47097", name: "Lauderdale" },
  { fips: "47099", name: "Lawrence" },
  { fips: "47101", name: "Lewis" },
  { fips: "47103", name: "Lincoln" },
  { fips: "47105", name: "Loudon" },
  { fips: "47107", name: "McMinn" },
  { fips: "47109", name: "McNairy" },
  { fips: "47111", name: "Macon" },
  { fips: "47113", name: "Madison" },
  { fips: "47115", name: "Marion" },
  { fips: "47117", name: "Marshall" },
  { fips: "47119", name: "Maury" },
  { fips: "47121", name: "Meigs" },
  { fips: "47123", name: "Monroe" },
  { fips: "47125", name: "Montgomery" },
  { fips: "47127", name: "Moore" },
  { fips: "47129", name: "Morgan" },
  { fips: "47131", name: "Obion" },
  { fips: "47133", name: "Overton" },
  { fips: "47135", name: "Perry" },
  { fips: "47137", name: "Pickett" },
  { fips: "47139", name: "Polk" },
  { fips: "47141", name: "Putnam" },
  { fips: "47143", name: "Rhea" },
  { fips: "47145", name: "Roane" },
  { fips: "47147", name: "Robertson" },
  { fips: "47149", name: "Rutherford" },
  { fips: "47151", name: "Scott" },
  { fips: "47153", name: "Sequatchie" },
  { fips: "47155", name: "Sevier" },
  { fips: "47157", name: "Shelby" },
  { fips: "47159", name: "Smith" },
  { fips: "47161", name: "Stewart" },
  { fips: "47163", name: "Sullivan" },
  { fips: "47165", name: "Sumner" },
  { fips: "47167", name: "Tipton" },
  { fips: "47169", name: "Trousdale" },
  { fips: "47171", name: "Unicoi" },
  { fips: "47173", name: "Union" },
  { fips: "47175", name: "Van Buren" },
  { fips: "47177", name: "Warren" },
  { fips: "47179", name: "Washington" },
  { fips: "47181", name: "Wayne" },
  { fips: "47183", name: "Weakley" },
  { fips: "47185", name: "White" },
  { fips: "47187", name: "Williamson" },
  { fips: "47189", name: "Wilson" },
] as const;

const BY_FIPS = new Map(
  TENNESSEE_COUNTIES.map((county) => [county.fips, county] as const),
);

export type JurisdictionLevel = "statewide" | "county";

export type TopicJurisdiction = {
  jurisdictionLevel: JurisdictionLevel;
  stateCode: typeof TENNESSEE_STATE_CODE;
  countyFips: string | null;
};

export function isTennesseeCountyFips(fips: string): boolean {
  return BY_FIPS.has(fips);
}

export function getTennesseeCountyByFips(
  fips: string,
): TennesseeCounty | null {
  return BY_FIPS.get(fips) ?? null;
}

export function countyDisplayName(fips: string): string | null {
  const county = getTennesseeCountyByFips(fips);
  return county ? `${county.name} County` : null;
}

export function formatTopicGeography(input: TopicJurisdiction): string {
  if (input.jurisdictionLevel === "statewide") {
    return "Tennessee statewide";
  }
  if (!input.countyFips) {
    return "Tennessee county (unspecified)";
  }
  return (
    countyDisplayName(input.countyFips) ??
    `Tennessee county ${input.countyFips}`
  );
}

export type GeographyValidation =
  | { ok: true; value: TopicJurisdiction }
  | { ok: false; error: string; code: string };

/**
 * Validate topic geography for this release (TN-only).
 * Does not confer eligibility, residency, or voting rights.
 */
export function validateTopicGeography(input: {
  jurisdictionLevel: string;
  stateCode?: string;
  countyFips?: string | null;
}): GeographyValidation {
  const level = input.jurisdictionLevel;
  if (level !== "statewide" && level !== "county") {
    return {
      ok: false,
      error: "Jurisdiction must be statewide or county",
      code: "TOPIC_GEOGRAPHY_INVALID",
    };
  }
  const stateCode = (input.stateCode ?? TENNESSEE_STATE_CODE)
    .trim()
    .toUpperCase();
  if (stateCode !== TENNESSEE_STATE_CODE) {
    return {
      ok: false,
      error: "This release only supports Tennessee (TN) topics",
      code: "TOPIC_GEOGRAPHY_STATE",
    };
  }
  const rawFips = input.countyFips?.trim() || null;
  if (level === "statewide") {
    if (rawFips) {
      return {
        ok: false,
        error: "Statewide topics must not set a county FIPS",
        code: "TOPIC_GEOGRAPHY_STATEWIDE_FIPS",
      };
    }
    return {
      ok: true,
      value: {
        jurisdictionLevel: "statewide",
        stateCode: TENNESSEE_STATE_CODE,
        countyFips: null,
      },
    };
  }
  if (!rawFips || !/^\d{5}$/.test(rawFips)) {
    return {
      ok: false,
      error: "County topics require a five-digit Tennessee county FIPS",
      code: "TOPIC_GEOGRAPHY_COUNTY_REQUIRED",
    };
  }
  if (!isTennesseeCountyFips(rawFips)) {
    return {
      ok: false,
      error: "Unknown or non-Tennessee county FIPS",
      code: "TOPIC_GEOGRAPHY_COUNTY_UNKNOWN",
    };
  }
  return {
    ok: true,
    value: {
      jurisdictionLevel: "county",
      stateCode: TENNESSEE_STATE_CODE,
      countyFips: rawFips,
    },
  };
}
