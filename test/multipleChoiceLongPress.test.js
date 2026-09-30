import assert from "assert";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(
  path.resolve(testDir, "../multipleChoiceLongPress.js"),
  "utf8"
);

assert.match(
  source,
  /multiple-choice-etymology-open/,
  "long-press handling should delegate the selected choice to app.js via the custom event"
);

assert.doesNotMatch(
  source,
  /from\s+['"][^'"]*pronunciation\.js(?:\?[^'"]*)?['"]/,
  "long-press handling must not import pronunciation.js directly; a second module URL can split pronunciation state"
);

assert.doesNotMatch(
  source,
  /from\s+['"][^'"]*morphemeAnalysisTarget\.js(?:\?[^'"]*)?['"]/,
  "long-press handling should not own shared analysis target state separately from app.js"
);

console.log("All multiple-choice long-press tests passed.");
