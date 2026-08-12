import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const workflowDir = path.join(
  process.cwd(),
  "src/features/demo/workflow",
);

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, files);
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts") && !entry.endsWith(".test.tsx")) {
      files.push(full);
    }
  }
  return files;
}

describe("workflow demo import isolation", () => {
  it("does not import gated auth/db/repository/mutation services", () => {
    const forbidden = [
      "@/db/client",
      "@/lib/auth/runtime",
      "@/lib/auth/guard",
      "@/lib/persistence/gated",
      "@/lib/conflicts/repository",
      "@/lib/claims/repository",
      "@/lib/evidence/repository",
      "@/lib/moderation/service",
      "@/lib/moderation/repository",
      "@/lib/submissions/submit",
      "@/lib/auth/audit-log",
      "getGatedDb",
      "assertEnvironmentSafe",
    ];
    const files = walk(workflowDir);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const needle of forbidden) {
        expect(text.includes(needle), `${path.basename(file)} contains ${needle}`).toBe(
          false,
        );
      }
    }
  });
});
