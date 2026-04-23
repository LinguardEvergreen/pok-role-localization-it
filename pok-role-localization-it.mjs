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
 * Client setting key: when true, the DOM overlay (which rewrites English
 * item names to Italian on actor/item sheets) is skipped. Useful for users
 * on a shared world who prefer the English UI while everyone else uses
 * Italian — Babele compendium translations are still applied globally, but
 * actor/item sheets show whatever is stored (which is English, thanks to
 * the preCreateItem hook and the name-migration pass).
 */
const SETTING_PREFER_ENGLISH = "preferEnglish";

/** Read the client setting safely (may be called before init completes). */
function getPreferEnglish() {
  try {
    return game.settings?.get?.(MODULE_ID, SETTING_PREFER_ENGLISH) === true;
  } catch (_e) {
    return false;
  }
}

/** Re-render every open sheet so the overlay toggle applies immediately. */
function rerenderOpenSheets() {
  try {
    for (const app of Object.values(ui.windows ?? {})) {
      if (app?.rendered) app.render(false);
    }
  } catch (_e) { /* ignore */ }
  try {
    const v2 = foundry?.applications?.instances;
    const iter = typeof v2?.values === "function" ? v2.values() : v2;
    if (iter) {
      for (const app of iter) {
        if (app?.rendered) app.render(false);
      }
    }
  } catch (_e) { /* ignore */ }
}

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

  // Always install the system-sheet prototype patches (they fix system
  // bugs that affect rank-up / evolution regardless of language preference).
  maybeInstallSheetPatch(app);

  // Always normalize stored Italian move names back to English. This is a
  // data-correctness fix (the system matches English names against the
  // seed learnsetByRank), not a display concern — independent of the
  // client's language preference. Idempotent, fire-and-forget.
  if (actor.type === "pokemon" && actor.isOwner) {
    migrateActorMoveNamesToEnglish(actor);
  }

  // User opted out of the Italian display overlay — leave the DOM alone.
  if (getPreferEnglish()) return;

  // Pokémon-specific sheets are the primary target but the same approach is
  // safe for any actor type. We do NOT touch the stored actor data — only
  // the rendered DOM.
  //
  // Pass 1: items rendered with [data-item-id] (moves, abilities, gear
  // pockets, active-ability link, etc.). translateItemWithin walks
  // descendants and replaces both text nodes and title/aria-label attrs.
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

  // Pass 2: learnset-config chips (they carry data-move-name pointing at
  // the English learnset entry but never a data-item-id — the chip text is
  // the raw string from actor.system.learnsetByRank).
  overlayLearnsetChips(rootEl);

  // Pass 3: battle-item display. The span that carries the item name sits
  // inside `.pokemon-battle-item-value` but has no data-item-id wrapping
  // the text, so Pass 1 misses it.
  overlayBattleItem(actor, rootEl);

  if (fixed > 0 && CONFIG.debug?.pokRoleIt) {
    console.debug(`[${MODULE_ID}] Overlaid ${fixed} embedded items on ${actor.name}.`);
  }

  // Biography overlay: replace the textarea value with the Italian biography
  // if we can match by actor name or system.species. Only applied when the
  // current stored value still equals the original English seed (so we never
  // clobber user edits).
  overlayBiographyField(actor, rootEl);

  // Move-rank relocation: when Babele translates move names to Italian, the
  // system groups moves by matching move.name against the English names in
  // `system.learnsetByRank` — so every translated move lands in "Altro".
  // We physically move each row from "Altro" back into its rank group.
  overlayMovesByRank(actor, rootEl);
}

/**
 * Translate `.learnset-move-chip` elements. Each chip carries
 * `data-move-name="<English name>"` and renders that name as its own text
 * followed by a remove button. We rewrite only the text node; the
 * `data-move-name` attribute is left as English so the system's remove
 * handler still matches the learnsetByRank string.
 */
function overlayLearnsetChips(rootEl) {
  const chips = rootEl.querySelectorAll?.(".learnset-move-chip[data-move-name]");
  if (!chips?.length) return;
  for (const chip of chips) {
    const english = chip.getAttribute("data-move-name");
    if (!english) continue;
    const italian = lookupItalian(english, ["move"]);
    if (!italian || italian === english) continue;
    for (const node of chip.childNodes) {
      if (node.nodeType === Node.TEXT_NODE && (node.nodeValue ?? "").trim() === english) {
        node.nodeValue = node.nodeValue.replace(english, italian);
      }
    }
  }
}

/**
 * Translate the battle-item (held item) chip shown under the Pokémon's
 * ability. The chip wrapper has class `.pokemon-battle-item-value` but no
 * data-item-id, so we resolve the item via `actor.system.battleItem` (an
 * item id) and rewrite the displayed text if it matches the English name.
 */
function overlayBattleItem(actor, rootEl) {
  const wrappers = rootEl.querySelectorAll?.(".pokemon-battle-item-value");
  if (!wrappers?.length) return;
  for (const wrapper of wrappers) {
    const span = wrapper.querySelector(":scope > span");
    if (!span) continue;
    const text = (span.textContent ?? "").trim();
    if (!text) continue;
    const italian = lookupItalian(text, ["gear"]);
    if (!italian || italian === text) continue;
    span.textContent = italian;
  }
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

/**
 * Rename Italian move-item names back to English on a Pokémon actor.
 *
 * No flag/memoization: the operation is cheap (one iteration over
 * `actor.items`) and has no side-effect when every name is already English,
 * so we run it unconditionally before any system flow that matches by
 * English name (rank-up, evolution). Previously we short-circuited with a
 * flag on the actor, but that masked cases where the flag was set after an
 * early no-op (e.g. before `moveReverseMap` was populated).
 *
 * Only performs embedded-document updates when the active user owns the
 * actor; otherwise Foundry would refuse with a permission error.
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

  if (updates.length === 0) return;

  try {
    await actor.updateEmbeddedDocuments("Item", updates);
    console.log(
      `[${MODULE_ID}] Renamed ${updates.length} move(s) on ${actor.name} back to English ` +
        `(display stays Italian via DOM overlay).`
    );
  } catch (err) {
    console.warn(`[${MODULE_ID}] Failed to migrate move names on ${actor.name}:`, err);
  }
}

/**
 * Wrap `Actor.prototype.evolve` so that we ALWAYS await the move-name
 * migration on the evolving actor before the system's `evolve()` runs.
 *
 * Why this matters: the stock system `evolve()` computes
 *   `oldUniqueMoves = items.filter(m => !allTargetMoveNames.has(m.name.lower()))`
 * where `allTargetMoveNames` comes from the target evolution's English
 * `learnsetByRank`. If the actor still has Italian move names (because the
 * sheet-open migration was scheduled but hadn't run yet, or because evolve
 * is being invoked from a macro/script that never opened the sheet), every
 * move fails the lookup and the "keep moves" dialog pops up spuriously.
 *
 * By normalizing move names to English first, the filter runs over an
 * English `m.name` against an English `allTargetMoveNames` and the dialog
 * only appears when there's a real set of orphan moves.
 */
function patchActorEvolve(ActorClass) {
  if (!ActorClass?.prototype?.evolve) return;
  if (ActorClass.prototype.__pokRoleItEvolvePatched) return;
  const original = ActorClass.prototype.evolve;
  ActorClass.prototype.evolve = async function(...args) {
    if (this.type === "pokemon") {
      try {
        await migrateActorMoveNamesToEnglish(this);
      } catch (err) {
        console.warn(`[${MODULE_ID}] Pre-evolve migration failed on ${this.name}:`, err);
      }
    }
    return original.apply(this, args);
  };
  ActorClass.prototype.__pokRoleItEvolvePatched = true;
  console.log(`[${MODULE_ID}] Wrapped Actor.evolve() to normalize move names first.`);
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
 * Wrap `performEvolution` so that:
 *   (a) moves the Pokémon already knew don't silently disappear, and
 *   (b) moves that were usable on the pre-evolution form stay usable after.
 *
 * Why this is needed: the system's `performEvolution` deletes every move and
 * tries to recreate them from the compendium via
 *
 *     moveIndex.find(e => e.name.toLowerCase() === moveName.toLowerCase())
 *
 * `moveIndex` comes from `game.packs.get("pok-role-system.moves").getIndex()`,
 * and with Babele active its entries are ITALIAN (e.g. "Frustata"). But
 * `moveName` is English (from the seed `learnsetByRank`, which we don't
 * translate). Every lookup fails, so the system deletes all moves and
 * recreates none. The sheet re-render then backfills only the current form's
 * learnset up to the current tier via `_syncLearnsetMovesToItems` (with
 * isUsable:false), and any auto-retained move at a HIGHER rank in the new
 * form (e.g. Vine Whip / Leech Seed on Bulbasaur → Ivysaur at Rookie) is
 * lost entirely ("me le toglie").
 *
 * Strategy:
 *   1. Snapshot {englishName → isUsable} before the system runs.
 *   2. Call original `performEvolution` as normal.
 *   3. Compute the moves that SHOULD exist after evolution — new form's
 *      learnset up to current tier + auto-retained + kept-old — and recreate
 *      any that are missing via a bilingual compendium lookup (English
 *      first, else the Italian translation from our overlay map).
 *   4. Re-apply `isUsable: true` on any move whose English name was usable
 *      on the pre-evolution form. Newly-introduced learnset moves (never
 *      known before) still start not-yet-usable, matching rank-up.
 */
async function patched_performEvolution(originalFn, targetSeedData, keptOldMoveNames, ...rest) {
  const actor = this.actor;

  // 1. Snapshot: English name (lower-case key) → { englishName, isUsable }.
  const preState = new Map();
  for (const item of actor?.items ?? []) {
    if (item?.type !== "move") continue;
    const nameKey = normalizeKey(item.name);
    const englishName = moveReverseMap.get(nameKey) ?? item.name;
    preState.set(normalizeKey(englishName), {
      englishName,
      isUsable: item.system?.isUsable !== false
    });
  }

  // 2. Run the system's performEvolution. Some moves will silently go missing
  //    if the Babele-translated move index doesn't match their English names.
  const result = await originalFn.call(this, targetSeedData, keptOldMoveNames, ...rest);
  if (result === false) return result;

  // 3. Compute the set of moves that should exist post-evolution.
  const newLearnset = targetSeedData?.learnsetByRank ?? {};
  const currentTier = actor.system.tier ?? "starter";
  const tierIdx = POKEMON_TIER_KEYS.indexOf(currentTier);

  /** normalizedKey → canonical English name */
  const expected = new Map();

  // a) Target's learnset up to (and including) current tier.
  if (tierIdx >= 0) {
    for (let i = 0; i <= tierIdx; i++) {
      const raw = `${newLearnset[POKEMON_TIER_KEYS[i]] ?? ""}`;
      for (const m of raw.split(",").map((s) => s.trim()).filter(Boolean)) {
        expected.set(normalizeKey(m), m);
      }
    }
  }
  // b) Auto-retained: any pre-evo move that appears in target's learnset at ANY rank.
  const allTargetKeys = new Set();
  for (const rank of POKEMON_TIER_KEYS) {
    const raw = `${newLearnset[rank] ?? ""}`;
    for (const m of raw.split(",").map((s) => s.trim()).filter(Boolean)) {
      allTargetKeys.add(normalizeKey(m));
    }
  }
  for (const { englishName } of preState.values()) {
    const key = normalizeKey(englishName);
    if (allTargetKeys.has(key)) expected.set(key, englishName);
  }
  // c) Kept-old moves the user explicitly selected to carry over.
  if (Array.isArray(keptOldMoveNames)) {
    for (const name of keptOldMoveNames) {
      if (!name) continue;
      expected.set(normalizeKey(name), `${name}`);
    }
  }

  // 4. What does the actor actually have right now? (Indexed by both the
  //    stored name AND its English reverse, in case Babele-translation beat
  //    our preCreateItem hook for any reason.)
  const actualKeys = new Set();
  for (const item of actor.items) {
    if (item?.type !== "move") continue;
    actualKeys.add(normalizeKey(item.name));
    const english = moveReverseMap.get(normalizeKey(item.name));
    if (english) actualKeys.add(normalizeKey(english));
  }

  // 5. Recreate anything missing via a bilingual compendium lookup.
  const missing = [];
  for (const [key, englishName] of expected) {
    if (!actualKeys.has(key)) missing.push(englishName);
  }
  if (missing.length > 0) {
    try {
      const pack = game.packs.get("pok-role-system.moves");
      if (pack) {
        const index = await pack.getIndex({ fields: ["name"] });
        const findEntry = (englishName) => {
          const italian = translationMaps.move.get(normalizeKey(englishName))?.translated;
          const enLower = englishName.toLowerCase();
          const itLower = italian?.toLowerCase();
          return index.find((e) => {
            if (!e?.name) return false;
            const n = e.name.toLowerCase();
            return n === enLower || (itLower && n === itLower);
          });
        };
        const toCreate = [];
        for (const englishName of missing) {
          const entry = findEntry(englishName);
          if (!entry) continue;
          const doc = await pack.getDocument(entry._id);
          if (!doc) continue;
          const obj = doc.toObject();
          obj.name = englishName; // force canonical English (preCreateItem also does this)
          delete obj._id;
          if (preState.get(normalizeKey(englishName))?.isUsable) {
            obj.system ??= {};
            obj.system.isUsable = true;
          }
          toCreate.push(obj);
        }
        if (toCreate.length > 0) {
          await actor.createEmbeddedDocuments("Item", toCreate);
          console.log(
            `[${MODULE_ID}] Recreated ${toCreate.length} move(s) missed by the ` +
              `system's Italian-index lookup on ${actor.name}.`
          );
        }
      }
    } catch (err) {
      console.warn(`[${MODULE_ID}] Failed to recreate missing moves post-evolve:`, err);
    }
  }

  // 6. Restore isUsable:true on any move that was usable before — covers
  //    moves recreated by `_syncLearnsetMovesToItems` with isUsable:false.
  try {
    const updates = [];
    for (const item of actor.items) {
      if (item?.type !== "move") continue;
      const englishName = moveReverseMap.get(normalizeKey(item.name)) ?? item.name;
      const pre = preState.get(normalizeKey(englishName));
      if (!pre?.isUsable) continue;
      if (item.system?.isUsable === false) {
        updates.push({ _id: item.id, "system.isUsable": true });
      }
    }
    if (updates.length > 0) {
      await actor.updateEmbeddedDocuments("Item", updates);
      console.log(
        `[${MODULE_ID}] Restored isUsable on ${updates.length} retained move(s) ` +
          `after evolving ${actor.name}.`
      );
    }
  } catch (err) {
    console.warn(`[${MODULE_ID}] Failed to restore isUsable post-evolution:`, err);
  }

  return result;
}

/**
 * Install the sheet-class patches on the first Pokémon actor sheet we see.
 * Wraps `_syncLearnsetMovesToItems` (bilingual compendium lookup) and
 * `performEvolution` (preserve usable-flag on retained moves). Uses
 * `app.constructor.prototype` so we don't need to reach into the system's
 * internal exports.
 */
function maybeInstallSheetPatch(app) {
  if (sheetPatchInstalled) return;
  const proto = app?.constructor?.prototype;
  if (!proto || typeof proto._syncLearnsetMovesToItems !== "function") return;

  proto._syncLearnsetMovesToItems = patched_syncLearnsetMovesToItems;

  if (typeof proto.performEvolution === "function" && !proto.__pokRoleItEvolutionPatched) {
    const original = proto.performEvolution;
    proto.performEvolution = function(...args) {
      return patched_performEvolution.call(this, original, ...args);
    };
    proto.__pokRoleItEvolutionPatched = true;
  }

  sheetPatchInstalled = true;
  console.log(
    `[${MODULE_ID}] Patched _syncLearnsetMovesToItems (bilingual lookup) and ` +
      `performEvolution (preserve isUsable on retained moves).`
  );
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
  if (getPreferEnglish()) return;

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
  // Client-scope setting: allow a user to opt out of the Italian DOM
  // overlay while the rest of the table uses Italian. Compendium
  // translations via Babele remain global (they're driven by core lang).
  try {
    game.settings.register(MODULE_ID, SETTING_PREFER_ENGLISH, {
      name: "Mostra nomi originali in inglese",
      hint:
        "Se attivo, le schede degli attori e degli oggetti mostrano i nomi " +
        "originali in inglese anziché la traduzione italiana. Impostazione per-client: " +
        "utile se preferisci l'inglese pur lasciando il modulo attivo per gli altri giocatori. " +
        "(Le traduzioni Babele dei compendi non sono influenzate da questa opzione; " +
        "per disattivarle completamente cambia la lingua principale di Foundry o disabilita Babele.)",
      scope: "client",
      config: true,
      type: Boolean,
      default: false,
      onChange: () => rerenderOpenSheets()
    });
  } catch (err) {
    console.warn(`[${MODULE_ID}] Failed to register client setting:`, err);
  }

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

  // Wrap Actor.evolve() so stored move names are normalized to English
  // before the system's evolve logic runs (prevents the spurious
  // keep-moves dialog when moves were renamed by Babele in a prior session).
  const ActorClass = CONFIG.Actor?.documentClass;
  if (ActorClass) patchActorEvolve(ActorClass);

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
