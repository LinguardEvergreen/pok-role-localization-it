/**
 * Extract the free-text middle section of every Pokémon biography into a
 * single JSON file that can be translated in batches and consumed by
 * build-biographies.mjs.
 *
 * Output: data/pokedex-descriptions.json
 *   {
 *     "<english description>": "<italian description or empty string>"
 *   }
 *
 * The build script will use this lookup when assembling the final biography
 * text. Any entry that is still empty keeps the English prose in place.
 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { parseBiography } from "./lib-parse-biography.mjs";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, "..");
const SYSTEM_ROOT = path.resolve(ROOT, "..", "Pok-Role-Module");
const SEED_FILE = path.join(SYSTEM_ROOT, "module", "seeds", "generated", "pokemon-actor-seeds.mjs");
const OUT_FILE = path.join(ROOT, "data", "pokedex-descriptions.json");

const seedModule = await import(url.pathToFileURL(SEED_FILE).href);
const POKEMON = seedModule.POKEMON_ACTOR_COMPENDIUM_ENTRIES;

function parseFreeText(bio) {
  const parts = parseBiography(bio);
  return parts?.free ?? "";
}

let existing = {};
if (fs.existsSync(OUT_FILE)) {
  existing = JSON.parse(fs.readFileSync(OUT_FILE, "utf8"));
}

const unique = new Set();
for (const pk of POKEMON) {
  const bio = pk?.system?.biography;
  if (!bio) continue;
  const free = parseFreeText(bio);
  if (free) unique.add(free);
}

const out = {};
for (const key of [...unique].sort()) {
  out[key] = existing[key] ?? "";
}

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2) + "\n", "utf8");

const translated = Object.values(out).filter(v => v && v.length > 0).length;
console.log(`Wrote ${Object.keys(out).length} unique free-text descriptions to ${OUT_FILE}`);
console.log(`  translated=${translated}, pending=${Object.keys(out).length - translated}`);
