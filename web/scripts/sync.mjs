// Copies deployment + recorded demo data from contracts/ into public/ so the app reads real on-chain addresses.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
mkdirSync("public", { recursive: true });
for (const f of ["31611.json", "demo-run.json"]) {
  const src = `../contracts/deployments/${f}`;
  if (existsSync(src)) copyFileSync(src, `public/${f}`);
}
