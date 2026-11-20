#!/usr/bin/env node
/**
 * Client-side secret guard. Runs before `npm start`, `npm run android|ios` and
 * EAS builds. Fails if anything that looks like a server credential could end
 * up inside the app bundle — the Nuance and Anthropic keys must live only in
 * the Cloudflare Worker.
 *
 * Checks:
 *  1. mobile/.env* files (except .env.example) and EXPO_PUBLIC_* process env
 *     vars (how EAS injects config) for secret-looking names or values.
 *  2. App source and config (src/, app.json, eas.json) for key-shaped strings.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

/** Values shaped like real credentials. */
const KEY_VALUE = [
  { label: "Nuance API key", pattern: /\bnk_[A-Za-z0-9_-]{12,}/ },
  { label: "Nuance session token", pattern: /\bst_[A-Za-z0-9_-]{24,}/ },
  { label: "Anthropic API key", pattern: /\bsk-ant-[A-Za-z0-9_-]{12,}/ },
  { label: "private key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
];
/** Variable names that must never be in the app's environment. */
const FORBIDDEN_NAME = /NUANCE|ANTHROPIC|SECRET|PASSWORD|PRIVATE|SALT|API_KEY|ACCESS_TOKEN/i;

const problems = [];

function checkValue(where, name, value) {
  if (name && FORBIDDEN_NAME.test(name)) {
    problems.push(`${where}: "${name}" is a server-side secret name. It must not be in the app's configuration.`);
  }
  for (const { label, pattern } of KEY_VALUE) {
    if (pattern.test(value)) problems.push(`${where}${name ? ` (${name})` : ""}: looks like a ${label}.`);
  }
}

// 1a. .env files
for (const file of readdirSync(root)) {
  if (!file.startsWith(".env") || file === ".env.example") continue;
  const path = join(root, file);
  if (!statSync(path).isFile()) continue;
  readFileSync(path, "utf8")
    .split(/\r?\n/)
    .forEach((line, index) => {
      const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (match) checkValue(`${file}:${index + 1}`, match[1], match[2]);
    });
}

// 1b. EXPO_PUBLIC_* in the process environment (EAS environment variables)
for (const [name, value] of Object.entries(process.env)) {
  if (name.startsWith("EXPO_PUBLIC_")) checkValue("environment", name, value ?? "");
}

// 2. Source and config files
const scanTargets = ["src", "app.json", "eas.json"];
function scan(path) {
  if (!existsSync(path)) return;
  const stats = statSync(path);
  if (stats.isDirectory()) {
    for (const entry of readdirSync(path)) scan(join(path, entry));
    return;
  }
  if (!/\.(tsx?|jsx?|json|mjs|cjs)$/.test(path)) return;
  const text = readFileSync(path, "utf8");
  for (const { label, pattern } of KEY_VALUE) {
    if (pattern.test(text)) problems.push(`${relative(root, path)}: contains something that looks like a ${label}.`);
  }
}
for (const target of scanTargets) scan(join(root, target));

if (problems.length) {
  console.error("\n✖ Possible secret in the mobile app — stopped before it could be bundled.\n");
  for (const problem of problems) console.error(`  • ${problem}`);
  console.error(
    "\n  API keys belong only in the Cloudflare Worker:\n" +
      "    cd backend; npx wrangler secret put NUANCE_API_KEY\n" +
      "  The app only needs EXPO_PUBLIC_API_BASE_URL. See docs/credentials.md.\n",
  );
  process.exit(1);
}
console.log("✔ No secrets found in the app's configuration or source.");
