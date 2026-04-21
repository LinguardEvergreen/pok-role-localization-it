/**
 * Poké Role System - Italian Localization bootstrap.
 *
 * Responsibilities:
 *  1. Register a Babele translation directory so that the Italian pack JSONs
 *     under compendium/it override English names/descriptions in the
 *     pok-role-system compendia (handled by Babele).
 *  2. Translate the names of embedded items (moves, abilities, held items…)
 *     shown on the Pokémon actor sheet. Babele only touches compendium docs,
 *     so world actors that already contain English item names (typical after
 *     importing from the compendium) still show English. We fix that with a
 *     lightweight DOM-level overlay that never modifies the stored data.
 *  3. The pokemon-actors pack JSON (with the `biography` mapping) lets Babele
 *     translate the Pokémon Pokédex biographies at compendium read time.
 */

const MODULE_ID = "pok-role-localization-it";
const TARGET_LANG = "it";
const LANG_DIR = "compendium/it";

/**
 * Packs whose entries we want to overlay on the actor sheet.
 * Keys = item.type used by the pok-role-system for that pack.
 */
const OVERLAY_PACKS = [
  { file: "pok-role-system.moves.json",           type: "move"   },
  { file: "pok-role-system.abilities.json",       type: "ability"},
  { file: "pok-role-system.held-items.json",      type: "gear"   },
  { file: "pok-role-system.trainer-items.json",   type: "gear"   },
  { file: "pok-role-system.healing-items.json",   type: "gear"   },
  { file: "pok-role-system.pokemon-care-items.json", type: "gear" },
  { file: "pok-role-system.evolutionary-items.json", type: "gear" }
];

/** Pokémon biographies live in a single pack; we load it separately. */
const BIOGRAPHIES_PACK_FILE = "pok-role-system.pokemon-actors.json";

/** species/actor-name → Italian biography string. */
const biographyMap = new Map();

/**
 * Flat lookup map keyed by English item name (case-insensitive / trimmed).
 * Value: { name, description, system?: {...} } — whatever the JSON entry holds.
 *
 * We build one map per item-type so we can scope replacements correctly.
 * `__all__` is a union used as a fallback (e.g. active-ability header where
 * we don't have the item-type hint from the DOM).
 */
const translationMaps = {
  move: new Map(),
  ability: new Map(),
  gear: new Map(),
  __all__: new Map()
};

/**
 * Italian → English reverse lookup for move names (case-insensitive).
 * Used by the move-rank overlay so that Italian-named moves on a sheet can
 * still be matched against the actor's English `system.learnsetByRank`.
 */
const moveReverseMap = new Map();

/**
 * Rank keys used by pok-role-system for Pokémon tiers, in display order.
 * Mirrors module/constants.mjs POKEMON_TIER_KEYS. We duplicate it here so the
 * overlay is resilient: if the system updates the constant we'll still work
 * for the keys we know; unknown extra keys are simply left in Altro.
 */
const POKEMON_TIER_KEYS = [
  "none",
  "starter",
  "rookie",
  "standard",
  "advanced",
  "expert",
  "ace",
  "master",
  "champion"
];

/** Normalize an English name for lookup. */
function normalizeKey(str) {
  return `${str ?? ""}`.trim().toLowerCase();
}

/**
 * Perform the Babele registration using whichever API is available.
 * Babele 2.5.5+ exposes `game.babele`; older builds expose `Babele.get()`.
 */
function registerWithBabele() {
  const payload = { module: MODULE_ID, lang: TARGET_LANG, dir: LANG_DIR };

  if (game?.babele?.register) {
    game.babele.register(payload);
    return "game.babele";
  }

  if (typeof Babele !== "undefined" && typeof Babele.get === "function") {
    Babele.get().register(payload);
    return "Babele.get()";
  }

  return null;
}

/**
 * Load a translation JSON file from this module's compendium/it directory.
 * Returns null if the file isn't present or can't be parsed.
 */
async function loadTranslationFile(filename) {
  const url = `modules/${MODULE_ID}/${LANG_DIR}/${filename}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[${MODULE_ID}] Could not fetch ${url}: ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn(`[${MODULE_ID}] Error loading ${url}`, err);
    return null;
  }
}

/**
 * Build the English → Italian overlay maps.
 *
 * Pack JSON shape (Babele pack): { label, entries: { "English Name": { name: "Nome", ... } } }
 */
async function buildTranslationMaps() {
  for (const { file, type } of OVERLAY_PACKS) {
    const data = await loadTranslationFile(file);
    if (!data?.entries) continue;

    for (const [english, entry] of Object.entries(data.entries)) {
      if (!entry || typeof entry !== "object") continue;
      const italian = entry.name;
      if (!italian || italian === english) continue;

      const key = normalizeKey(english);
      // Don't overwrite an existing specific-type entry; gear packs can share
      // names (rare) but first-come-first-served is fine.
      if (!translationMaps[type].has(key)) {
        translationMaps[type].set(key, { original: english, translated: italian, entry });
      }
      if (!translationMaps.__all__.has(key)) {
        translationMaps.__all__.set(key, { original: english, translated: italian, entry });
      }
    }
  }

  // Build the Italian → English reverse map for moves only (we only need it
  // for matching against the actor's English `learnsetByRank`).
  moveReverseMap.clear();
  for (const hit of translationMaps.move.values()) {
    if (hit?.translated && hit?.original) {
      moveReverseMap.set(normalizeKey(hit.translated), hit.original);
    }
  }

  console.log(
    `[${MODULE_ID}] Overlay maps built: ` +
      `moves=${translationMaps.move.size}, ` +
      `abilities=${translationMaps.ability.size}, ` +
      `gear=${translationMaps.gear.size}, ` +
      `move-reverse=${moveReverseMap.size}.`
  );
}

/** Load the Pokémon biographies pack into `biographyMap`. */
async function buildBiographyMap() {
  const data = await loadTranslationFile(BIOGRAPHIES_PACK_FILE);
  if (!data?.entries) return;
  for (const [englishName, entry] of Object.entries(data.entries)) {
    const bio = entry?.biography;
    if (!bio) continue;
    biographyMap.set(normalizeKey(englishName), bio);
  }
  console.log(`[${MODULE_ID}] Loaded ${biographyMap.size} Pokémon biography translations.`);
}

/**
 * Look up a full translation entry (italian name + description + etc.)
 * scoped to item-type hints if supplied. Returns the entry object or null.
 */
function lookupEntry(englishName, typeHints = ["move", "ability", "gear"]) {
  const key = normalizeKey(englishName);
  if (!key) return null;
  for (const t of typeHints) {
    const hit = translationMaps[t]?.get(key);
    if (hit) return hit;
  }
  return translationMaps.__all__.get(key) ?? null;
}

/**
 * Look up an Italian translation for an English name, scoped to item-type
 * hints if supplied. Returns the Italian string or null.
 */
function lookupItalian(englishName, typeHints = ["move", "ability", "gear"]) {
  const key = normalizeKey(englishName);
  if (!key) return null;
  for (const t of typeHints) {
    const hit = translationMaps[t]?.get(key);
    if (hit) return hit.translated;
  }
  const fallback = translationMaps.__all__.get(key);
  return fallback ? fallback.translated : null;
}

/**
 * Replace every immediate-child text node of `el` whose trimmed text equals
 * `oldText` with `newText`. Keeps whitespace/formatting intact.
 */
function replaceTextNode(el, oldText, newText) {
  if (!el || !oldText || oldText === newText) return false;
  let replaced = false;
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const raw = node.nodeValue ?? "";
      if (raw.trim() === oldText) {
        node.nodeValue = raw.replace(oldText, newText);
        replaced = true;
      }
    }
  }
  return replaced;
}

/**
 * Translate all text/title occurrences of `original` → `italian` inside `scope`
 * that relate to this particular item (scope is the element with data-item-id).
 */
function translateItemWithin(scope, original, italian) {
  if (!scope || !original || !italian || original === italian) return;

  // Replace `title="Original"` attributes on any descendant.
  const titled = scope.querySelectorAll(`[title="${CSS.escape(original)}"]`);
  titled.forEach(el => el.setAttribute("title", italian));

  // Replace `aria-label="Original"` attributes as well.
  const labelled = scope.querySelectorAll(`[aria-label="${CSS.escape(original)}"]`);
  labelled.forEach(el => el.setAttribute("aria-label", italian));

  // Walk descendants and translate any direct text node matching exactly.
  const all = [scope, ...scope.querySelectorAll("*")];
  for (const el of all) {
    replaceTextNode(el, original, italian);
  }
}

/**
 * Map a pok-role-system item type to the translation-map bucket.
 */
function mapTypeHint(itemType) {
  switch (itemType) {
    case "move":    return ["move"];
    case "ability": return ["ability"];
    case "gear":    return ["gear"];
    default:        return ["move", "ability", "gear"];
  }
}

/**
 * Translate embedded-item names on a Pokémon actor sheet.
 *
 * Strategy:
 *  - Iterate each element with [data-item-id]; look up the matching embedded
 *    item on the actor; replace its English name text/title with Italian.
 *  - Additionally sweep the sheet for elements likely to show the active
 *    ability / held-item header names (they don't carry data-item-id for the
 *    text itself) using a fallback text-match pass scoped to the container.
 */
function overlayActorSheet(app, rootEl) {
  const actor = app?.actor ?? app?.object;
  if (!actor || !rootEl) return;

  // Install the system-sheet prototype patch once, lazily.
  maybeInstallSheetPatch(app);

  // Normalize stored Italian move names back to English on first render
  // (idempotent — flagged on the actor). Fire-and-forget; the next render
  // will pick up the updated names for the DOM overlay.
  if (actor.type === "pokemon" && actor.isOwner) {
    if (actor.getFlag?.(MIGRATION_FLAG_SCOPE, MIGRATION_FLAG_KEY) !== true) {
      migrateActorMoveNamesToEnglish(actor);
    }
  }

  // Pokémon-specific sheets are the primary target but the same approach is
  // safe for any actor type since Babele already handled compendium actors.
  // We do NOT touch the stored actor data — only the rendered DOM.

  const scopes = rootEl.querySelectorAll("[data-item-id]");
  let fixed = 0;
  for (const scope of scopes) {
    const itemId = scope.getAttribute("data-item-id");
    if (!itemId) continue;
    const item = actor.items?.get(itemId);
    if (!item) continue;
    const italian = lookupItalian(item.name, mapTypeHint(item.type));
    if (!italian) continue;
    translateItemWithin(scope, item.name, italian);
    fixed++;
  }

  // Second pass: some elements (active ability link, battle item chip, etc.)
  // have a data-item-id on the *row* but their text is a literal copy of the
  // item.name. translateItemWithin above already handles those because we
  // walk descendants. Nothing extra to do.

  if (fixed > 0 && CONFIG.debug?.pokRoleIt) {
    console.debug(`[${MODULE_ID}] Overlaid ${fixed} embedded items on ${actor.name}.`);
  }

  // Biography overlay: replace the textarea value with the Italian biography
  // if we can match by actor name or system.species. Only applied when the
  // current stored value still equals the original English seed (so we never
  // clobber user edits). Keeping the value on a textarea displays Italian;
  // if the user saves without edits the English is replaced with Italian.
  overlayBiographyField(actor, rootEl);

  // Move-rank relocation: when Babele translates move names to Italian, the
  // system groups moves by matching move.name against the English names in
  // `system.learnsetByRank` — so every translated move lands in "Altro".
  // We physically move each row from "Altro" back into its rank group.
  overlayMovesByRank(actor, rootEl);
}

/**
 * Fix the "all moves land in Altro" bug for Pokémon actor sheets when moves
 * have been translated to Italian.
 *
 * The pok-role-system builds the `movesByRank` grouping by matching each
 * move's `name` against the English comma-lists in `system.learnsetByRank`.
 * Babele renames moves to Italian, so no match → every row falls into the
 * `other` group labelled "Altro".
 *
 * Strategy (DOM-only, never touch actor data):
 *  1. Build an English name → rank map from `actor.system.learnsetByRank`.
 *  2. For each `<tr data-item-id>` under any `.moves-rank-group`, resolve the
 *     embedded item; if its name doesn't match English directly, translate
 *     Italian → English via `moveReverseMap` and try again.
 *  3. Look up the existing `.moves-rank-group` whose header text matches the
 *     localized rank label. If none exists (template only renders ranks that
 *     have moves, so the target rank may not have been emitted), clone the
 *     structure from an existing group to create a new one at the correct
 *     position.
 *  4. Move the `<tr>` into the target group's `<tbody>`. Remove the Altro
 *     group if it becomes empty.
 */
function overlayMovesByRank(actor, rootEl) {
  const learnset = actor?.system?.learnsetByRank;
  if (!learnset || typeof learnset !== "object") return;

  // English move name → rank key (lowercased for robustness).
  const englishNameToRank = new Map();
  for (const rank of POKEMON_TIER_KEYS) {
    const raw = `${learnset[rank] ?? ""}`;
    for (const n of raw.split(",").map(s => s.trim()).filter(Boolean)) {
      const key = normalizeKey(n);
      if (!englishNameToRank.has(key)) englishNameToRank.set(key, rank);
    }
  }
  if (englishNameToRank.size === 0) return;

  const groups = Array.from(rootEl.querySelectorAll(".moves-rank-group"));
  if (groups.length === 0) return;

  // Build localized label → rank key map using the system's label pattern
  // POKROLE.Pokemon.TierValues.<Capitalized>. Labels fall back to the key
  // itself when the localization isn't registered.
  const localize = (k) => {
    try { return game.i18n?.localize?.(k) ?? k; } catch (_e) { return k; }
  };
  const localizedLabelToRank = new Map();
  for (const key of POKEMON_TIER_KEYS) {
    const cap = key.charAt(0).toUpperCase() + key.slice(1);
    const localized = localize(`POKROLE.Pokemon.TierValues.${cap}`);
    localizedLabelToRank.set(normalizeKey(localized), key);
  }
  const otherLocalized = normalizeKey(localize("POKROLE.Common.Other"));

  /** Tag existing groups by rank based on header text. */
  const groupByRank = new Map();
  for (const group of groups) {
    const header = group.querySelector(".moves-rank-header");
    if (!header) continue;
    const text = normalizeKey(header.textContent ?? "");
    let rank = localizedLabelToRank.get(text);
    if (!rank && text === otherLocalized) rank = "other";
    if (rank && !groupByRank.has(rank)) groupByRank.set(rank, group);
  }

  /**
   * Ensure a .moves-rank-group for `rank` exists and return it. If it is
   * missing, we clone the DOM structure of any existing group (table/thead
   * intact so interactivity is preserved) and insert it in the correct
   * rank order.
   */
  const ensureGroupForRank = (rank) => {
    const existing = groupByRank.get(rank);
    if (existing) return existing;

    // Clone from any non-"other" group if possible (stable thead); fall back
    // to the first available group.
    let template = null;
    for (const [k, el] of groupByRank) {
      if (k !== "other") { template = el; break; }
    }
    if (!template) template = groups[0];
    if (!template) return null;

    const clone = template.cloneNode(true);
    // Empty the tbody on the clone.
    const cloneBody = clone.querySelector("tbody");
    if (cloneBody) cloneBody.replaceChildren();
    // Update header text to localized label for the new rank.
    const cloneHeader = clone.querySelector(".moves-rank-header");
    if (cloneHeader) {
      const cap = rank.charAt(0).toUpperCase() + rank.slice(1);
      cloneHeader.textContent = localize(`POKROLE.Pokemon.TierValues.${cap}`);
    }

    // Insert at correct position: after the last existing rank group whose
    // rank comes before this one in POKEMON_TIER_KEYS, and before "other".
    const parent = template.parentElement;
    if (!parent) return null;

    const targetIndex = POKEMON_TIER_KEYS.indexOf(rank);
    let insertBefore = null;
    // Find the first existing group whose rank is AFTER `rank` (or is "other").
    const ordered = Array.from(parent.querySelectorAll(".moves-rank-group"));
    for (const el of ordered) {
      const header = el.querySelector(".moves-rank-header");
      if (!header) continue;
      const text = normalizeKey(header.textContent ?? "");
      let elRank = localizedLabelToRank.get(text);
      if (!elRank && text === otherLocalized) elRank = "other";
      if (!elRank) continue;
      const idx = elRank === "other" ? Infinity : POKEMON_TIER_KEYS.indexOf(elRank);
      if (idx > targetIndex) { insertBefore = el; break; }
    }

    parent.insertBefore(clone, insertBefore);
    groupByRank.set(rank, clone);
    return clone;
  };

  let moved = 0;
  const rows = Array.from(rootEl.querySelectorAll(".moves-rank-group tr[data-item-id]"));
  for (const row of rows) {
    const itemId = row.getAttribute("data-item-id");
    if (!itemId) continue;
    const item = actor.items?.get(itemId);
    if (!item || item.type !== "move") continue;

    // Resolve the English move name: try item.name first (world actors
    // imported before Italian was installed still carry English); otherwise
    // map Italian → English via our reverse dictionary.
    let english = null;
    const nameKey = normalizeKey(item.name);
    if (englishNameToRank.has(nameKey)) {
      english = item.name;
    } else {
      const reversed = moveReverseMap.get(nameKey);
      if (reversed && englishNameToRank.has(normalizeKey(reversed))) {
        english = reversed;
      }
    }
    if (!english) continue;

    const targetRank = englishNameToRank.get(normalizeKey(english));
    if (!targetRank) continue;

    const targetGroup = ensureGroupForRank(targetRank);
    if (!targetGroup) continue;
    const targetBody = targetGroup.querySelector("tbody");
    if (!targetBody) continue;

    if (row.parentElement !== targetBody) {
      targetBody.appendChild(row);
      moved++;
    }
  }

  // Drop the "Altro" group entirely if it's now empty.
  const otherGroup = groupByRank.get("other");
  if (otherGroup) {
    const otherBody = otherGroup.querySelector("tbody");
    if (otherBody && otherBody.querySelectorAll("tr[data-item-id]").length === 0) {
      otherGroup.remove();
      groupByRank.delete("other");
    }
  }

  if (moved > 0 && CONFIG.debug?.pokRoleIt) {
    console.debug(`[${MODULE_ID}] Relocated ${moved} moves to their correct rank groups on ${actor.name}.`);
  }
}

// ---------------------------------------------------------------------------
// Keep move-item `name` English on stored actor data
// ---------------------------------------------------------------------------
//
// The pok-role-system matches move.name against English names in
// `system.learnsetByRank` for rank-up (adds new moves) and evolution
// (auto-retain / keep-moves dialog). If Babele has rewritten the stored
// item.name to Italian, every match fails: rank-up can't find the move in
// the Italian-translated compendium index, evolution treats every move as
// "unique to the old form", and the keep-moves dialog prompts the user
// unnecessarily.
//
// Fix: keep the STORED `item.name` in English at all times; render Italian
// via the existing DOM overlay (`translateItemWithin`) only.
//   - `preCreateItem` hook rewrites Italian → English before persist.
//   - A sheet-open migration renames already-Italian items back to English.
//   - `_syncLearnsetMovesToItems` is patched to search the (Babele-translated)
//     pack index bilingually, so rank-up can still create missing moves.

/** Migration flag key on an actor to avoid redundant migrations. */
const MIGRATION_FLAG_SCOPE = MODULE_ID;
const MIGRATION_FLAG_KEY = "moveNamesMigrated";

/**
 * Rename Italian move-item names back to English on a Pokémon actor. Runs
 * idempotently; a per-actor flag short-circuits subsequent invocations once
 * no Italian names remain.
 *
 * IMPORTANT: only performs an embedded-document update when the active user
 * actually owns the actor; otherwise a non-owning player would get a
 * permission error from Foundry. The GM (or the owning player) will
 * eventually open the sheet and trigger the rename.
 */
async function migrateActorMoveNamesToEnglish(actor) {
  if (!actor || actor.type !== "pokemon") return;
  if (!actor.isOwner) return;
  if (moveReverseMap.size === 0) return; // maps not built yet

  const updates = [];
  for (const item of actor.items) {
    if (item.type !== "move") continue;
    const englishFromReverse = moveReverseMap.get(normalizeKey(item.name));
    if (englishFromReverse && englishFromReverse !== item.name) {
      updates.push({ _id: item.id, name: englishFromReverse });
    }
  }

  if (updates.length === 0) {
    // Mark as migrated so we don't revisit every render.
    try {
      if (actor.getFlag(MIGRATION_FLAG_SCOPE, MIGRATION_FLAG_KEY) !== true) {
        await actor.setFlag(MIGRATION_FLAG_SCOPE, MIGRATION_FLAG_KEY, true);
      }
    } catch (_e) { /* flag write may fail for non-owners, ignore */ }
    return;
  }

  try {
    await actor.updateEmbeddedDocuments("Item", updates);
    await actor.setFlag(MIGRATION_FLAG_SCOPE, MIGRATION_FLAG_KEY, true);
    console.log(
      `[${MODULE_ID}] Renamed ${updates.length} move(s) on ${actor.name} back to English ` +
        `(display stays Italian via DOM overlay).`
    );
  } catch (err) {
    console.warn(`[${MODULE_ID}] Failed to migrate move names on ${actor.name}:`, err);
  }
}

/**
 * preCreateItem hook: if a move item is being created on an actor with an
 * Italian-translated name, rewrite `_source.name` to the English canonical
 * form BEFORE it is persisted. The DOM overlay still renders it as Italian.
 *
 * This catches: rank-up creation flow, evolution flow, user drag-drop from
 * the Italian compendium, and any other path that funnels through
 * Item#_preCreate.
 */
function preCreateItemHandler(item, data, _options, _userId) {
  try {
    if (data?.type !== "move") return;
    const parent = item?.parent;
    if (!parent || parent.documentName !== "Actor") return;
    const italianName = `${data.name ?? ""}`.trim();
    if (!italianName) return;
    const english = moveReverseMap.get(normalizeKey(italianName));
    if (!english || english === italianName) return;
    // `updateSource` is the public API for mutating a document's source
    // before persistence inside a preCreate hook.
    item.updateSource({ name: english });
  } catch (err) {
    console.warn(`[${MODULE_ID}] preCreateItem normalization failed:`, err);
  }
}

// ---------------------------------------------------------------------------
// Patch: bilingual pack-index lookup in _syncLearnsetMovesToItems
// ---------------------------------------------------------------------------
//
// The system version matches learnset names (English) against a compendium
// index that Babele has translated to Italian — so the `find` always fails
// and no moves are created on rank-up. We override with a bilingual variant:
// the index is searched by the English name OR its Italian translation.
//
// We install the override on the actor sheet's class the first time we see
// a Pokémon sheet render, so we don't need to reach into the system's
// internals at ready-time.

/** Has the sheet-class override already been installed? */
let sheetPatchInstalled = false;

/**
 * Replacement for PokRoleActorSheet.prototype._syncLearnsetMovesToItems that
 * handles the Italian-Babele scenario. Logic mirrors the system version but
 * (a) treats existing move names as English OR Italian, and (b) looks up
 * compendium entries by either language.
 */
async function patched_syncLearnsetMovesToItems() {
  if (this.actor.type !== "pokemon" || !this.isEditable) return;
  const currentTier = this.actor.system.tier ?? "starter";
  const tierIndex = POKEMON_TIER_KEYS.indexOf(currentTier);
  if (tierIndex < 0) return;

  const ranksUpToCurrent = POKEMON_TIER_KEYS.slice(0, tierIndex + 1);
  const moveNamesToAdd = [];
  for (const rank of ranksUpToCurrent) {
    const raw = `${this.actor.system.learnsetByRank?.[rank] ?? ""}`;
    const names = raw.split(",").map((s) => s.trim()).filter(Boolean);
    moveNamesToAdd.push(...names);
  }

  // Existing names: include both the raw Italian/English stored name AND
  // its English canonical form, so any comparison against English learnset
  // names succeeds even before migration has run on this actor.
  const existingNames = new Set();
  for (const i of this.actor.items) {
    if (i.type !== "move") continue;
    const raw = `${i.name ?? ""}`.trim();
    if (!raw) continue;
    existingNames.add(raw);
    const english = moveReverseMap.get(normalizeKey(raw));
    if (english) existingNames.add(english);
  }

  const COMMON_MOVE_NAMES = new Set([
    "Struggle (Physical)", "Struggle (Special)", "Grapple",
    "Help Another", "Cover An Ally", "Run Away",
    "Ambush", "Clash", "Evasion", "Stabilize An Ally"
  ]);
  const namesToCreate = [];
  const seen = new Set();
  for (const name of moveNamesToAdd) {
    if (existingNames.has(name) || seen.has(name) || COMMON_MOVE_NAMES.has(name)) continue;
    seen.add(name);
    namesToCreate.push(name);
  }
  if (namesToCreate.length === 0) return;

  const pack = game.packs.get("pok-role-system.moves");
  if (!pack) return;
  const index = await pack.getIndex({ fields: ["name"] });

  // Build an index lookup that matches by either English OR Italian.
  const findEntry = (englishName) => {
    const italian = translationMaps.move.get(normalizeKey(englishName))?.translated;
    return index.find((e) => {
      if (!e?.name) return false;
      if (e.name === englishName) return true;
      if (italian && e.name === italian) return true;
      return false;
    });
  };

  const newMoves = [];
  for (const name of namesToCreate) {
    const entry = findEntry(name);
    if (!entry) continue;
    const doc = await pack.getDocument(entry._id);
    if (!doc) continue;
    const moveData = doc.toObject();
    // Babele may have translated name on retrieval; force English so the
    // stored item can be matched by the system logic later. Description
    // stays translated (we want Italian description shown on the sheet).
    moveData.name = name;
    moveData.system.isUsable = false;
    delete moveData._id;
    newMoves.push(moveData);
  }
  if (newMoves.length > 0) {
    await this.actor.createEmbeddedDocuments("Item", newMoves);
  }
}

/**
 * Install the `_syncLearnsetMovesToItems` override on the first Pokémon
 * actor sheet we see. Uses `app.constructor.prototype` to find the class
 * without depending on the system's internal exports.
 */
function maybeInstallSheetPatch(app) {
  if (sheetPatchInstalled) return;
  const proto = app?.constructor?.prototype;
  if (!proto || typeof proto._syncLearnsetMovesToItems !== "function") return;
  proto._syncLearnsetMovesToItems = patched_syncLearnsetMovesToItems;
  sheetPatchInstalled = true;
  console.log(`[${MODULE_ID}] Patched _syncLearnsetMovesToItems for bilingual learnset matching.`);
}

/**
 * If the actor's biography textarea still shows the seed English template and
 * we have a matching Italian translation, replace the textarea value.
 */
function overlayBiographyField(actor, rootEl) {
  const textarea = rootEl.querySelector?.('textarea[name="system.biography"]');
  if (!textarea) return;

  const currentValue = textarea.value ?? "";
  if (!currentValue.startsWith("Corebook Pokedex import")) return; // user edited — leave alone

  const candidateKeys = [actor?.name, actor?.system?.species, actor?.prototypeToken?.name]
    .filter(Boolean)
    .map(normalizeKey);

  for (const key of candidateKeys) {
    const italian = biographyMap.get(key);
    if (italian) {
      textarea.value = italian;
      return;
    }
  }
}

/**
 * Translate an embedded-item sheet: window title, description & effect
 * textareas, and the `system.held.passiveEffect` input.
 *
 * We only replace a textarea/input value if it still equals the original
 * English text from the compendium, so manual edits are preserved.
 */
function overlayItemSheet(app, rootEl) {
  const item = app?.object ?? app?.item;
  if (!item || !rootEl) return;

  const typeHints = mapTypeHint(item.type);
  const entry = lookupEntry(item.name, typeHints);
  if (!entry) return;

  const italian = entry.translated;
  const translatedPayload = entry.entry ?? {};

  // Window title.
  const frame = rootEl.closest?.(".app") ?? rootEl.closest?.(".application");
  const title = frame?.querySelector?.(".window-title");
  if (title && title.textContent?.trim() === item.name) {
    title.textContent = italian;
  }

  /**
   * Swap a textarea/input value to the Italian translation only if it
   * currently equals the English original on the item document (meaning the
   * user hasn't edited it). This gives Italian display on read and preserves
   * the translation if the user hits "Save" without edits.
   */
  const swapField = (selector, englishValue, italianValue) => {
    if (!italianValue || italianValue === englishValue) return;
    const el = rootEl.querySelector(selector);
    if (!el) return;
    if ((el.value ?? "") !== englishValue) return;
    el.value = italianValue;
  };

  swapField(
    'textarea[name="system.description"]',
    item.system?.description,
    translatedPayload.description
  );
  swapField(
    'textarea[name="system.effect"]',
    item.system?.effect,
    translatedPayload["system.effect"]
  );
  swapField(
    'input[name="system.held.passiveEffect"]',
    item.system?.held?.passiveEffect,
    translatedPayload["system.held.passiveEffect"]
  );
}

/** Normalize renderActorSheet callback signature across Foundry versions. */
function resolveHtmlRoot(html) {
  // v12 passes a jQuery; v13 passes HTMLElement or jQuery depending on sheet.
  if (!html) return null;
  if (html instanceof HTMLElement) return html;
  if (typeof html === "object" && html[0] instanceof HTMLElement) return html[0];
  return null;
}

/**
 * Register the Babele pack very early so it is discovered during Babele's
 * own init. Babele is declared as a required dependency so its init hook
 * always runs before ours in practice, but we also listen to `babele.init`
 * as a safety net for reversed ordering.
 */
Hooks.once("init", () => {
  const via = registerWithBabele();
  if (via) {
    console.log(`[${MODULE_ID}] Italian Babele pack registered via ${via}.`);
  } else {
    console.warn(
      `[${MODULE_ID}] Babele not detected at init. ` +
        `Install and enable "Babele" to apply Italian compendium translations.`
    );
  }
});

Hooks.once("babele.init", () => {
  const via = registerWithBabele();
  if (via) {
    console.log(`[${MODULE_ID}] Italian Babele pack re-registered via ${via} on babele.init.`);
  }
});

/**
 * Sanity checks + build the actor-sheet overlay maps at ready-time.
 */
Hooks.once("ready", async () => {
  const babeleActive = !!game.modules.get("babele")?.active;

  if (!babeleActive) {
    ui.notifications?.warn(
      `Poké Role - Italiano: il modulo Babele non risulta attivo. ` +
        `Installa e abilita "Babele" per vedere le traduzioni italiane dei compendi.`,
      { permanent: true }
    );
    console.warn(`[${MODULE_ID}] Babele module is not active.`);
    return;
  }

  const coreLang = game.settings.get("core", "language");
  if (coreLang !== TARGET_LANG) {
    console.warn(
      `[${MODULE_ID}] Core language is "${coreLang}"; Babele compendium ` +
        `translations require "it". The actor-sheet overlay will still run.`
    );
    // We still build the overlay because the user may want Italian names
    // on existing English-data actors even if the UI is English.
  }

  await Promise.all([buildTranslationMaps(), buildBiographyMap()]);
  console.log(`[${MODULE_ID}] Ready. Actor-sheet overlay active.`);
});

/**
 * DOM overlays — run after every actor / item sheet render.
 * Using both the v1 and v2 render hooks covers every sheet implementation.
 */
Hooks.on("renderActorSheet", (app, html) => {
  const root = resolveHtmlRoot(html);
  overlayActorSheet(app, root);
});

Hooks.on("renderItemSheet", (app, html) => {
  const root = resolveHtmlRoot(html);
  overlayItemSheet(app, root);
});

// Keep stored move-item names in English so the pok-role-system's rank-up
// and evolution matching against English `learnsetByRank` keeps working.
// The DOM overlay translates to Italian at render time.
Hooks.on("preCreateItem", preCreateItemHandler);

// ApplicationV2-based sheets (Foundry v13 Pokémon sheet is ApplicationV2).
Hooks.on("renderApplicationV2", (app, element) => {
  const root = element instanceof HTMLElement ? element : resolveHtmlRoot(element);
  if (!root) return;
  // Heuristic: dispatch based on document type.
  const doc = app?.document ?? app?.object ?? app?.actor ?? app?.item;
  if (!doc) return;
  if (doc.documentName === "Actor") {
    overlayActorSheet(app, root);
  } else if (doc.documentName === "Item") {
    overlayItemSheet(app, root);
  }
});
