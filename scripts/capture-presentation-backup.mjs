import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const outDir = path.resolve("docs/presentation-backup");

const captures = [
  { name: "home-desktop", path: "/", width: 1280, height: 800 },
  { name: "home-mobile", path: "/", width: 390, height: 844 },
  { name: "join-desktop", path: "/join", width: 1280, height: 800 },
  {
    name: "topic-cedar-desktop",
    path: "/topics/cedar-river-drought-surcharge",
    width: 1280,
    height: 800,
  },
  {
    name: "consult-cedar-mobile",
    path: "/topics/cedar-river-drought-surcharge/consult",
    width: 390,
    height: 844,
  },
  {
    name: "agenda-cedar-desktop",
    path: "/agenda/cedar-river-drought-surcharge",
    width: 1280,
    height: 800,
  },
  {
    name: "deliberation-cedar-desktop",
    path: "/deliberation/cedar-river-drought-surcharge",
    width: 1280,
    height: 800,
  },
  {
    name: "decision-cedar-desktop",
    path: "/decisions/cedar-river-drought-surcharge",
    width: 1280,
    height: 800,
  },
  {
    name: "decision-cedar-mobile",
    path: "/decisions/cedar-river-drought-surcharge",
    width: 390,
    height: 844,
  },
  { name: "transparency-desktop", path: "/transparency", width: 1280, height: 800 },
  { name: "demo-desktop", path: "/demo", width: 1280, height: 800 },
  { name: "demo-mobile", path: "/demo", width: 390, height: 844 },
];

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();

for (const capture of captures) {
  await page.setViewportSize({ width: capture.width, height: capture.height });
  await page.goto(new URL(capture.path, baseURL).toString(), {
    waitUntil: "networkidle",
  });
  const filePath = path.join(outDir, `${capture.name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  console.log(`Wrote ${filePath}`);
}

await writeFile(
  path.join(outDir, "README.md"),
  `# Presentation backup screenshots

Captured ${new Date().toISOString().slice(0, 10)} from \`${baseURL}\`.

Use these static images if the live demonstration encounters a local-machine problem. They are synthetic UI only.

| File | Route | Viewport |
| --- | --- | --- |
${captures
  .map(
    (item) =>
      `| \`${item.name}.png\` | \`${item.path}\` | ${item.width}×${item.height} |`,
  )
  .join("\n")}

Regenerate with a running production server:

\`\`\`bash
npm run build
npm run start
npm run capture:screenshots
\`\`\`
`,
);

await browser.close();
