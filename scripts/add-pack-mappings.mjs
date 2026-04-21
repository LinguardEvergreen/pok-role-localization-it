/**
 * Add a `mapping` block to every existing Babele pack JSON so descriptions
 * and other non-standard fields route to the correct paths on
 * pok-role-system documents.
 *
 * Pok-Role-Module stores descriptions at `system.description` (NOT
 * `system.description.value` — which is what Babele's default Item mapping
 * expects). Without overrides, none of our description translations actually
 * applied, so names were Italian and descriptions stayed English.
 *
 * This script is idempotent: it merges mappings into whatever is already there.
 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PACK_DIR = path.resolve(__dirname, "..", "compendium", "it");

const PACK_MAPPINGS = {
  "pok-role-system.moves.json": {
    description: "system.description"
  },
  "pok-role-system.abilities.json": {
    description: "system.description",
    "system.effect": "system.effect"
  },
  "pok-role-system.held-items.json": {
    description: "system.description",
    "system.held.passiveEffect": "system.held.passiveEffect"
  },
  "pok-role-system.trainer-items.json": {
    description: "system.description"
  },
  "pok-role-system.healing-items.json": {
    description: "system.description"
  },
  "pok-role-system.pokemon-care-items.json": {
    description: "system.description"
  },
  "pok-role-system.evolutionary-items.json": {
    description: "system.description"
  }
};

for (const [file, mapping] of Object.entries(PACK_MAPPINGS)) {
  const fullPath = path.join(PACK_DIR, file);
  if (!fs.existsSync(fullPath)) {
    console.warn(`Skipping missing file: ${fullPath}`);
    continue;
  }
  const data = JSON.parse(fs.readFileSync(fullPath, "utf8"));
  const merged = { ...(data.mapping ?? {}), ...mapping };
  const next = {
    label: data.label,
    mapping: merged,
    entries: data.entries
  };
  fs.writeFileSync(fullPath, JSON.stringify(next, null, 2) + "\n", "utf8");
  console.log(`Updated ${file} → mapping=${JSON.stringify(merged)}`);
}
