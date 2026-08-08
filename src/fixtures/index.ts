import { parseAndAssertCatalog } from "@/domain/validateCatalog";
import type { FixtureCatalog } from "@/domain/types";

import { fixtureCatalog as rawFixtureCatalog } from "@/fixtures/catalog";

/** Validated synthetic fixture catalog used by the Phase 1 demonstration. */
export const fixtureCatalog: FixtureCatalog =
  parseAndAssertCatalog(rawFixtureCatalog);

export { rawFixtureCatalog };
