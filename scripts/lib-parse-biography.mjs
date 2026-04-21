/**
 * Shared parser for the pok-role-system biography template:
 *   "Corebook Pokedex import #NNN. Category: <CAT>. <FREE>. Abilities: <A,B>."
 *
 * Extracted to a separate module so build-biographies and extract-bio-descriptions
 * stay in sync: the `free` text a builder looks up is exactly the one the
 * extractor writes.
 */

export function parseBiography(raw) {
  if (typeof raw !== "string") return null;
  const text = raw.trim();

  const prefixMatch = text.match(/^Corebook Pokedex import #(\d+)\.\s*/);
  if (!prefixMatch) return null;
  const dexNumber = prefixMatch[1];
  let rest = text.slice(prefixMatch[0].length);

  const catMatch = rest.match(/^Category:\s*([^.]+)\.\s*/);
  let category = "";
  if (catMatch) {
    category = catMatch[1].trim();
    rest = rest.slice(catMatch[0].length);
  }

  const abilityMatch = rest.match(/\s*Abilities:\s*([^.]+)\.?\s*$/);
  let abilities = [];
  if (abilityMatch) {
    abilities = abilityMatch[1].split(",").map((s) => s.trim()).filter(Boolean);
    rest = rest.slice(0, -abilityMatch[0].length);
  }

  // Strip any leading stray period-space that can appear when the category
  // itself ends in a period (e.g. "Pokédex has no data." in the seed).
  const free = rest.replace(/^\s*\.\s*/, "").trim().replace(/\.\s*$/, "").trim();
  return { dexNumber, category, free, abilities };
}
