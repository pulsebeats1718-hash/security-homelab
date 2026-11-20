#!/usr/bin/env node
/**
 * Pre-deploy guard: confirms the Worker's required secrets exist on Cloudflare
 * before `wrangler deploy` runs. Reads secret NAMES only (`wrangler secret list`);
 * values are never fetched, printed or stored.
 *
 * Skip (e.g. in CI that sets secrets another way): SKIP_SECRET_CHECK=1
 */
import { spawnSync } from "node:child_process";

const REQUIRED = {
  NUANCE_API_KEY: "Nuance Labs API key (live conversations)",
  END_USER_SALT: "random string for hashing device ids",
};
const OPTIONAL = {
  ANTHROPIC_API_KEY: "post-call reviews",
  APP_CLIENT_KEY: "client speed bump",
};

if (process.env.SKIP_SECRET_CHECK === "1") {
  console.log("Secret check skipped (SKIP_SECRET_CHECK=1).");
  process.exit(0);
}

const result = spawnSync("npx", ["wrangler", "secret", "list", "--format", "json"], {
  encoding: "utf8",
  shell: process.platform === "win32", // npx is a .cmd shim on Windows
});

const output = result.stdout ?? "";
const start = output.indexOf("[");
let names = null;
if (result.status === 0 && start !== -1) {
  try {
    names = JSON.parse(output.slice(start)).map((entry) => entry.name);
  } catch {
    names = null;
  }
}

if (!names) {
  console.error("\n✖ Couldn't read the Worker's secrets from Cloudflare.");
  console.error("  Are you logged in (npx wrangler login), and have you set the secrets yet?");
  console.error("  First-time setup:  npx wrangler secret put NUANCE_API_KEY");
  console.error("                     npx wrangler secret put END_USER_SALT");
  console.error("  Details: docs/credentials.md\n");
  if (result.stderr) console.error(result.stderr.trim().split("\n").slice(-3).join("\n"));
  process.exit(1);
}

const missing = Object.keys(REQUIRED).filter((name) => !names.includes(name));
for (const [name, purpose] of Object.entries(REQUIRED)) {
  console.log(`${names.includes(name) ? "✔" : "✖"} ${name.padEnd(18)} required  — ${purpose}`);
}
for (const [name, purpose] of Object.entries(OPTIONAL)) {
  console.log(`${names.includes(name) ? "✔" : "·"} ${name.padEnd(18)} optional  — ${purpose}`);
}

if (missing.length) {
  console.error(`\n✖ Missing required secret(s): ${missing.join(", ")}`);
  for (const name of missing) console.error(`  npx wrangler secret put ${name}`);
  console.error("  Deploy stopped. Details: docs/credentials.md\n");
  process.exit(1);
}
console.log("\nAll required secrets are set on Cloudflare.\n");
