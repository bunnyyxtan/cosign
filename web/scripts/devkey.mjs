// Writes the gitignored web/.env.development.local for the dev-only test wallet: node scripts/devkey.mjs COSIGNER
import { readFileSync, writeFileSync } from "node:fs";
const role = (process.argv[2] || "COSIGNER").toUpperCase();
const env = Object.fromEntries(readFileSync("../.env", "utf8").split(/\r?\n/).filter((l) => l.includes("=")).map((l) => l.split(/=(.*)/s).slice(0, 2)));
if (!env[`${role}_KEY`]) throw new Error(`no ${role}_KEY in .env`);
writeFileSync(".env.development.local", `VITE_DEV_PRIVATE_KEY=${env[`${role}_KEY`]}\n`);
console.log(`dev wallet set to ${role} ${env[`${role}_ADDR`]}`);
