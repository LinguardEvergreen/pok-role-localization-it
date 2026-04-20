// Mocks the Foundry runtime just enough to import compendium-seed.mjs
// and dump the static ITEM_SEEDS (trainer/healing/care/evolutionary/weather/status).

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SYSTEM_ROOT = path.resolve(__dirname, "..", "..", "Pok-Role-Module");
const OUT_DIR = path.resolve(__dirname, "..", "data", "extracted");
fs.mkdirSync(OUT_DIR, { recursive: true });

globalThis.game = { system: { path: "systems/pok-role-system" } };
globalThis.foundry = {
  utils: {
    deepClone: (value) => structuredClone(value)
  }
};

const seedModule = await import(
  url.pathToFileURL(path.join(SYSTEM_ROOT, "module", "seeds", "compendium-seed.mjs")).href
);

const { STATIC_ITEM_SEEDS_BY_PACK } = seedModule;

for (const [pack, entries] of Object.entries(STATIC_ITEM_SEEDS_BY_PACK)) {
  const simplified = entries.map((entry) => ({
    name: entry.name,
    type: entry.type,
    description: entry.system?.description ?? "",
    effect: entry.system?.effect ?? "",
    passiveEffect: entry.system?.held?.passiveEffect ?? "",
    category: entry.system?.category ?? ""
  }));
  const outFile = path.join(OUT_DIR, `pack-${pack}.json`);
  fs.writeFileSync(outFile, JSON.stringify(simplified, null, 2));
  console.log(`Pack ${pack}: ${simplified.length} entries -> ${outFile}`);
}
