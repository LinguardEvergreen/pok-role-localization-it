/**
 * Build pok-role-system.pokemon-actors.json — the Babele pack that translates
 * the Pokédex biography on each Pokémon actor in the compendium.
 *
 * The pok-role-system bakes each biography into system.biography using a
 * predictable template:
 *
 *   "Corebook Pokedex import #NNN. Category: <CATEGORY> Pokémon. <FREE TEXT>. Abilities: A, B."
 *
 * We translate the structural wrapper + the Abilities list, and keep the free
 * Pokédex prose in English. Hand-translating ~1200 unique descriptions isn't
 * feasible in one pass, but the structural translation + ability names make
 * the biography immediately more usable for an Italian-speaking player.
 *
 * Hand-edited overrides can live in data/biographies-overrides.json:
 *   { "Bulbasaur": { "biography": "..." }, ... }
 * These win over the auto-generated output.
 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, "..");
const SYSTEM_ROOT = path.resolve(ROOT, "..", "Pok-Role-Module");
const SEED_FILE = path.join(SYSTEM_ROOT, "module", "seeds", "generated", "pokemon-actor-seeds.mjs");
const OUT_FILE = path.join(ROOT, "compendium", "it", "pok-role-system.pokemon-actors.json");
const OVERRIDES_FILE = path.join(ROOT, "data", "biographies-overrides.json");
const ABILITIES_PACK = path.join(ROOT, "compendium", "it", "pok-role-system.abilities.json");

// ---------------------------------------------------------------------------
// Load source data
// ---------------------------------------------------------------------------

const seedModule = await import(url.pathToFileURL(SEED_FILE).href);
const POKEMON = seedModule.POKEMON_ACTOR_COMPENDIUM_ENTRIES;
if (!Array.isArray(POKEMON)) {
  throw new Error("Could not load POKEMON_ACTOR_COMPENDIUM_ENTRIES.");
}

const abilityPack = JSON.parse(fs.readFileSync(ABILITIES_PACK, "utf8"));
const abilityMap = new Map();
for (const [en, entry] of Object.entries(abilityPack.entries ?? {})) {
  if (entry?.name) abilityMap.set(en.toLowerCase(), entry.name);
}

let overrides = {};
if (fs.existsSync(OVERRIDES_FILE)) {
  overrides = JSON.parse(fs.readFileSync(OVERRIDES_FILE, "utf8"));
}

// ---------------------------------------------------------------------------
// Translate the structural template
// ---------------------------------------------------------------------------

/**
 * Parse a biography string into structural parts. Returns null if it doesn't
 * match the expected template (we leave those untouched).
 *
 * Template:
 *   "Corebook Pokedex import #NNN. Category: X. <FREE TEXT>. Abilities: A, B."
 * where Category may include "Pokémon" or "Pokemon" or be "Pokédex has no data".
 */
function parseBiography(raw) {
  if (typeof raw !== "string") return null;
  const text = raw.trim();

  // Prefix
  const prefixMatch = text.match(/^Corebook Pokedex import #(\d+)\.\s*/);
  if (!prefixMatch) return null;
  const dexNumber = prefixMatch[1];
  let rest = text.slice(prefixMatch[0].length);

  // Category ("Category: ...Pokémon." or "Category: Pokédex has no data..")
  const catMatch = rest.match(/^Category:\s*([^.]+)\.\s*/);
  let category = "";
  if (catMatch) {
    category = catMatch[1].trim();
    rest = rest.slice(catMatch[0].length);
  }

  // Abilities suffix at the very end.
  const abilityMatch = rest.match(/\s*Abilities:\s*([^.]+)\.?\s*$/);
  let abilities = [];
  if (abilityMatch) {
    abilities = abilityMatch[1].split(",").map((s) => s.trim()).filter(Boolean);
    rest = rest.slice(0, -abilityMatch[0].length);
  }

  const free = rest.trim();
  return { dexNumber, category, free, abilities };
}

/** Italianize a category label (minimal: "X Pokémon" → "Pokémon X"). */
function translateCategory(cat) {
  if (!cat) return "";
  // Pokédex-has-no-data case.
  if (/Pok(é|e)dex has no data/i.test(cat)) return "Pokédex privo di dati";
  // Common case: "<Adjectives> Pokémon"
  const m = cat.match(/^(.*?)\s*Pok(é|e)mon\s*$/i);
  if (m) return `Pokémon ${m[1].trim()}`.replace(/\s+/g, " ");
  return cat;
}

/** Translate an ability name via our abilities Babele pack. */
function translateAbility(name) {
  const key = name.toLowerCase();
  return abilityMap.get(key) ?? name;
}

function buildItalianBiography(parts) {
  const { dexNumber, category, free, abilities } = parts;
  const segs = [];
  segs.push(`Voce del Corebook Pokédex #${dexNumber}.`);
  if (category) segs.push(`Categoria: ${translateCategory(category)}.`);
  if (free) segs.push(free.endsWith(".") ? free : `${free}.`);
  if (abilities.length > 0) {
    const translated = abilities.map(translateAbility);
    segs.push(`Abilità: ${translated.join(", ")}.`);
  }
  return segs.join(" ").replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Build entries
// ---------------------------------------------------------------------------

const entries = {};
let parsed = 0;
let skipped = 0;
const overridesUsed = new Set();

// Pokémon can repeat under different forms (Alolan, Galarian, Mega, etc.);
// seed file uses a unique `name` per form. We keep entries keyed by full name
// so Babele matches each variant separately.
for (const pk of POKEMON) {
  const name = pk?.name;
  const bio = pk?.system?.biography;
  if (!name || !bio) continue;

  if (overrides[name]?.biography) {
    entries[name] = { biography: overrides[name].biography };
    overridesUsed.add(name);
    continue;
  }

  const parts = parseBiography(bio);
  if (!parts) {
    skipped++;
    continue;
  }
  const italian = buildItalianBiography(parts);
  if (italian && italian !== bio) {
    entries[name] = { biography: italian };
    parsed++;
  }
}

// ---------------------------------------------------------------------------
// Write pack file
// ---------------------------------------------------------------------------

const pack = {
  label: "Pokémon (Attori)",
  mapping: {
    biography: "system.biography"
  },
  entries
};

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify(pack, null, 2) + "\n", "utf8");

console.log(
  `Wrote ${Object.keys(entries).length} entries to ${OUT_FILE}\n` +
    `  parsed=${parsed}, overrides=${overridesUsed.size}, skipped=${skipped}`
);
