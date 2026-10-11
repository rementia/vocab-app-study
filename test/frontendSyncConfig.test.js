import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (name) => readFileSync(new URL(name, import.meta.url), "utf8");
const config = read("../syncConfig.js");
const hosting = JSON.parse(read("../firebase.json"));
const app = read("../app.js");

assert.match(
  config,
  /export const SHEET_SYNC_WEB_APP_URL\s*=\s*["']{2}\s*;/,
  "Browser-visible sync URL must remain empty"
);
assert.match(
  config,
  /export const SHEET_SYNC_TOKEN\s*=\s*["']{2}\s*;/,
  "Browser-visible sync token must remain empty"
);
assert.ok(
  hosting.hosting?.ignore?.includes("syncConfig.js"),
  "The legacy sync config must be excluded from Hosting deploys"
);
assert.doesNotMatch(
  app,
  /\b(?:syncConfig\.js|sheetSyncService\.js)\b/,
  "The study app must not depend on the excluded legacy sync configuration"
);

console.log("Browser-side sync configuration security guard passed.");
