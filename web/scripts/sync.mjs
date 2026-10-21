// Copies deployment + recorded demo data from contracts/ into public/ so the app reads real on-chain addresses.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
mkdirSync("public", { recursive: true });
for (const f of ["31611.json", "demo-run.json"]) {
  const src = `../contracts/deployments/${f}`;
  if (existsSync(src)) copyFileSync(src, `public/${f}`);
}

// The website shows recorded transactions from src/site/recorded.ts; every hash there must be in the recorded run.
import { readFileSync } from "node:fs";
const run = readFileSync("../contracts/deployments/demo-run.json", "utf8").toLowerCase();
const shown = readFileSync("src/site/recorded.ts", "utf8").match(/0x[0-9a-f]{64}/gi) ?? [];
const missing = shown.filter((h) => !run.includes(h.toLowerCase()));
if (missing.length) {
  console.error(`recorded.ts has transactions that are not in demo-run.json: ${missing.join(", ")}`);
  process.exit(1);
}
