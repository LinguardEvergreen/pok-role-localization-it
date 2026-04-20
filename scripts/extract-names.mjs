// Extracts names + descriptions from the Pok-Role-Module seed files
// so we can generate Babele translation scaffolding.

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SYSTEM_ROOT = path.resolve(__dirname, "..", "..", "Pok-Role-Module");
const SEEDS_DIR = path.join(SYSTEM_ROOT, "module", "seeds", "generated");
const OUT_DIR = path.resolve(__dirname, "..", "data", "extracted");

fs.mkdirSync(OUT_DIR, { recursive: true });

const modules = {
  moves: "move-seeds.mjs",
  abilities: "ability-seeds.mjs",
  heldItems: "held-item-seeds.mjs",
  pokemon: "pokemon-actor-seeds.mjs"
};

for (const [key, file] of Object.entries(modules)) {
  const fullPath = path.join(SEEDS_DIR, file);
  const mod = await import(url.pathToFileURL(fullPath).href);
  const exportName = Object.keys(mod).find((k) => k.includes("COMPENDIUM_ENTRIES"));
  const entries = mod[exportName];

  const simplified = entries.map((entry) => {
    const system = entry.system ?? {};
    return {
      name: entry.name,
      type: entry.type,
      description: system.description ?? "",
      effect: system.effect ?? "",
      passiveEffect: system.held?.passiveEffect ?? "",
      category: system.category ?? ""
    };
  });

  const outFile = path.join(OUT_DIR, `${key}.json`);
  fs.writeFileSync(outFile, JSON.stringify(simplified, null, 2));
  console.log(`Wrote ${simplified.length} entries -> ${outFile}`);
}

// Also extract names only for quick reference
for (const [key, file] of Object.entries(modules)) {
  const fullPath = path.join(SEEDS_DIR, file);
  const mod = await import(url.pathToFileURL(fullPath).href);
  const exportName = Object.keys(mod).find((k) => k.includes("COMPENDIUM_ENTRIES"));
  const entries = mod[exportName];
  const names = entries.map((e) => e.name).sort();
  fs.writeFileSync(path.join(OUT_DIR, `${key}-names.json`), JSON.stringify(names, null, 2));
}

console.log("Done.");
