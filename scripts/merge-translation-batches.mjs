/**
 * Merge every data/translations-batch-*.json file into
 * data/pokedex-descriptions.json. Keys present in later batches overwrite
 * earlier ones; existing translations in the main dict are preserved unless
 * a batch provides a non-empty replacement.
 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, "..");
const DATA = path.join(ROOT, "data");
const MAIN = path.join(DATA, "pokedex-descriptions.json");

const main = JSON.parse(fs.readFileSync(MAIN, "utf8"));

const batchFiles = fs
  .readdirSync(DATA)
  .filter((f) => /^translations-batch-.*\.json$/.test(f))
  .sort();

let added = 0;
let replaced = 0;
for (const file of batchFiles) {
  const batch = JSON.parse(fs.readFileSync(path.join(DATA, file), "utf8"));
  for (const [key, value] of Object.entries(batch)) {
    if (typeof value !== "string" || value.trim().length === 0) continue;
    if (!(key in main)) {
      console.warn(`  ! ${file} has a key not present in the main dict: ${key.slice(0, 60)}...`);
      continue;
    }
    if (main[key] && main[key].trim().length > 0) {
      if (main[key] !== value) replaced++;
    } else {
      added++;
    }
    main[key] = value;
  }
  console.log(`Processed ${file} (${Object.keys(batch).length} entries)`);
}

// Preserve sorted-key order for stable diffs.
const sorted = Object.fromEntries(
  Object.keys(main)
    .sort()
    .map((k) => [k, main[k]])
);

fs.writeFileSync(MAIN, JSON.stringify(sorted, null, 2) + "\n", "utf8");

const translated = Object.values(sorted).filter((v) => v && v.length > 0).length;
console.log(
  `\nMain dict now has ${Object.keys(sorted).length} entries; ` +
    `${translated} translated, ${Object.keys(sorted).length - translated} pending. ` +
    `(added=${added}, replaced=${replaced})`
);
