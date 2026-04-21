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

  console.log(
    `[${MODULE_ID}] Overlay maps built: ` +
      `moves=${translationMaps.move.size}, ` +
      `abilities=${translationMaps.ability.size}, ` +
      `gear=${translationMaps.gear.size}.`
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
 * Translate the name shown in the header of an embedded ItemSheet if it
 * matches a known English item name. This is a best-effort pass: the title
 * lives in the window chrome, not the sheet body.
 */
function overlayItemSheet(app, rootEl) {
  const item = app?.object ?? app?.item;
  if (!item) return;

  const italian = lookupItalian(item.name, mapTypeHint(item.type));
  if (!italian) return;

  // Window title: Foundry puts the item name into the `.window-title` element
  // of the application frame. We climb up from rootEl to find it.
  const frame = rootEl?.closest?.(".app") ?? rootEl?.closest?.(".application");
  const title = frame?.querySelector?.(".window-title");
  if (title && title.textContent?.trim() === item.name) {
    title.textContent = italian;
  }
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
