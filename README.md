# Poké Role System - Italiano

<p align="center">
  <strong>Modulo di localizzazione italiana per il sistema Foundry VTT v13 <a href="https://github.com/RiccardoMont1/Pok-Role-Module">Pok-Role-Module</a></strong><br>
  Traduce nomi e descrizioni di Mosse, Abilità e Strumenti usando la terminologia ufficiale della Pokémon Central Wiki, mantenendo intatti i riferimenti interni del sistema.
</p>

<p align="center">
  <img alt="Foundry VTT v13" src="https://img.shields.io/badge/Foundry-v13-f36f24?style=for-the-badge">
  <img alt="Modulo 1.3.3" src="https://img.shields.io/badge/Modulo-1.3.3-2d7ff9?style=for-the-badge">
  <img alt="Sistema pok-role-system 1.3.0" src="https://img.shields.io/badge/Sistema-pok--role--system%201.3.0-d94b3d?style=for-the-badge">
  <img alt="Lingua IT" src="https://img.shields.io/badge/Lingua-IT-00a7c4?style=for-the-badge">
  <img alt="Richiede Babele" src="https://img.shields.io/badge/Richiede-Babele%202.0%2B-6f42c1?style=for-the-badge">
</p>

---

## Panoramica

`pok-role-localization-it` è un modulo di traduzione costruito sopra [Babele](https://foundryvtt.com/packages/babele). Non sostituisce i dati del sistema `pok-role-system`: li intercetta al volo sostituendo i campi visualizzati (`name`, `description`, effetti testuali) con la versione italiana.

I nomi originali inglesi vengono **preservati come identificatori interni**: schede Pokémon, link di compendio, macro e riferimenti esistenti continuano a funzionare anche quando l'interfaccia mostra i nomi in italiano.

La terminologia adottata segue la [Pokémon Central Wiki](https://wiki.pokemoncentral.it/) per mantenere la coerenza con i nomi ufficiali italiani di mosse, abilità e strumenti.

## Punti Salienti

| Area | Cosa è incluso |
| --- | --- |
| Mosse | 894 voci tradotte: nomi canonici (Pokémon Central Wiki) e descrizioni complete con glossario uniforme (Bersaglio Singolo, Bassa Precisione N, Mossa Tagliente/Vento/Sonora/Pugno/Proiettile, Reazione, Scottatura di 1°/2°/3° grado, Avvelenare Gravemente, Tentennare, ecc.) |
| Abilità | 305 voci tradotte con `name`, `description` narrativa e `system.effect` per la meccanica |
| Strumenti | Strumenti da Tenere (142), Strumenti Allenatore (33), Strumenti Curativi (33), Cura Pokémon (15), Evolutivi (10). Include tutti i passiveEffect delle Megapietre e dei Cristalli Z |
| Compatibilità | Nessuna modifica ai documenti originali: il modulo agisce solo tramite Babele e non rompe salvataggi, link interni o schede esistenti |
| Esclusioni volute | Condizioni Meteo e Stati Alterati, già tradotti nativamente dal sistema `pok-role-system` |

## Pack Tradotti

Il modulo ospita **7 pack di traduzione** in `compendium/it/`, uno per ogni pack del sistema `pok-role-system` che viene effettivamente tradotto.

| Pack del sistema | File di traduzione | Voci |
| --- | --- | --- |
| `pok-role-system.abilities` | [compendium/it/pok-role-system.abilities.json](compendium/it/pok-role-system.abilities.json) | 305 |
| `pok-role-system.moves` | [compendium/it/pok-role-system.moves.json](compendium/it/pok-role-system.moves.json) | 894 |
| `pok-role-system.held-items` | [compendium/it/pok-role-system.held-items.json](compendium/it/pok-role-system.held-items.json) | 142 |
| `pok-role-system.trainer-items` | [compendium/it/pok-role-system.trainer-items.json](compendium/it/pok-role-system.trainer-items.json) | 33 |
| `pok-role-system.healing-items` | [compendium/it/pok-role-system.healing-items.json](compendium/it/pok-role-system.healing-items.json) | 33 |
| `pok-role-system.pokemon-care-items` | [compendium/it/pok-role-system.pokemon-care-items.json](compendium/it/pok-role-system.pokemon-care-items.json) | 15 |
| `pok-role-system.evolutionary-items` | [compendium/it/pok-role-system.evolutionary-items.json](compendium/it/pok-role-system.evolutionary-items.json) | 10 |

> I nomi dei file seguono la convenzione Babele `<systemId>.<packName>.json`: Babele abbina ogni file al pack corrispondente cercando esattamente questo formato.

I pack `pokemon-status` e `weather-conditions` sono **esclusi di proposito**: il sistema `pok-role-system` fornisce già traduzioni italiane native per Stati Alterati e Condizioni Meteo.

Il pack `pokemon-actors` **non viene tradotto**: i nomi delle specie Pokémon restano nella forma ufficiale internazionale (identica tra italiano e inglese dalla prima generazione).

## Requisiti

| Dipendenza | Versione minima |
| --- | --- |
| Foundry VTT | v13 (verificato su build 351) |
| Sistema [`pok-role-system`](https://github.com/RiccardoMont1/Pok-Role-Module) | 1.3.0 |
| Modulo [`babele`](https://foundryvtt.com/packages/babele) | 2.0.0 |

## Installazione

### Manifest URL

Nella finestra **Installa Modulo** di Foundry incolla:

```text
https://raw.githubusercontent.com/LinguardEvergreen/pok-role-localization-it/main/module.json
```

### Download diretto

```text
https://github.com/LinguardEvergreen/pok-role-localization-it/archive/refs/heads/main.zip
```

### Installazione manuale / sviluppo locale

1. Installa e abilita il modulo [**Babele**](https://foundryvtt.com/packages/babele) nel tuo mondo.
2. Clona o scarica questo repository nella cartella `Data/modules/pok-role-localization-it` della tua installazione Foundry.
3. Abilita il modulo dalle impostazioni del mondo.
4. Ricarica il mondo. I compendi del sistema saranno ora visualizzati in italiano.

### ⚠️ Imposta Foundry in italiano

Babele applica le traduzioni **solo se la lingua del client Foundry è "Italiano"**. Se l'interfaccia è in inglese (o qualsiasi altra lingua), i file italiani vengono scartati in fase di indicizzazione.

Per attivarle:

1. In Foundry, apri **Game Settings → Configure Settings → Core Settings → Language** (oppure **Impostazioni → Configura Impostazioni → Impostazioni del Core → Lingua**).
2. Seleziona **Italiano** (`it`).
3. Ricarica il mondo (`F5`).

Il modulo mostra un avviso permanente in alto a destra se rileva che la lingua è impostata su qualcosa di diverso da `it`.

## Come Funziona

Al caricamento di Foundry, il modulo registra presso Babele la directory `compendium/it` contenente un file JSON per ciascun pack del sistema. Ogni file segue il formato Babele standard:

```json
{
  "label": "Mosse",
  "entries": {
    "<Nome Inglese Originale>": {
      "name": "<Nome Italiano>",
      "description": "<Descrizione Italiana>",
      "system.effect": "<Effetto meccanico tradotto>"
    }
  }
}
```

Babele intercetta la lettura dei documenti dei compendi e sostituisce al volo i campi tradotti **senza toccare i documenti originali**. Le chiavi di lookup usate dalle schede Pokémon restano in inglese, garantendo piena retro-compatibilità.

Se Babele non è attivo, il modulo emette un avviso in console e in UI senza interrompere il caricamento del mondo.

## Struttura della Repository

| Percorso | Scopo |
| --- | --- |
| [module.json](module.json) | Manifest Foundry VTT |
| [pok-role-localization-it.mjs](pok-role-localization-it.mjs) | Bootstrap ESM: registra la directory Babele |
| [lang/it.json](lang/it.json) | Stringhe UI del modulo |
| [compendium/it/](compendium/it/) | I 7 file di traduzione Babele |
| [scripts/](scripts/) | Utility di estrazione/diff per la manutenzione delle traduzioni |

## Scelte di Terminologia

Alcune scelte ricorrenti del glossario usato in questo modulo:

- **Chance Dice** → *dadi Fortuna*
- **Will Points** → *punti Volontà*
- **Reaction / Late Reaction** → *Reazione / Reazione Tardiva*
- **Clash** → *Contrasto*
- **Evade / Evasion** → *Eludere / Elusione*
- **Damage Pool / Extra Dice** → *pool di Danno / dadi Extra*
- **Typeless Damage** → *Danno Senza Tipo*
- **Entry Hazard** → *Trappola d'Ingresso*
- **Force Field** → *Campo di Forza*
- **Shield / Cutter / Wind / Sound / Fist / Projectile / Bite / Powder Move** → *Mossa Scudo / Tagliente / Vento / Sonora / Pugno / Proiettile / Morso / Polvere*
- **Switcher Move** → *Mossa Sostituzione*
- **Charge Move** → *Mossa a Caricamento*
- **Rampage** → *Furia Cieca*
- **Flinch** → *Tentennare*
- **Bad Poison** → *Avvelenamento Grave*
- **Burn 1/2/3** → *Scottatura di 1°/2°/3° grado*

I nomi di mosse, abilità e strumenti seguono la [Pokémon Central Wiki](https://wiki.pokemoncentral.it/); i nomi dei tipi (Coleottero, Buio, Elettro, Folletto, Lotta, Volante, Spettro, Psico, ecc.) seguono la terminologia ufficiale dei videogiochi Pokémon localizzati in italiano.

## Risoluzione problemi

**Non vedo le traduzioni in italiano nei compendi**

Tre cause in ordine di probabilità:

1. **Lingua di Foundry non impostata su italiano.** Questa è la causa più comune. Babele filtra i pacchetti di traduzione in base a `game.settings.get("core", "language")`. Vedi la sezione [⚠️ Imposta Foundry in italiano](#️-imposta-foundry-in-italiano). Il modulo mostra un avviso permanente quando la lingua è sbagliata.
2. **Babele non attivo.** Controlla che nelle impostazioni del mondo il modulo `Babele` sia effettivamente abilitato (non basta averlo installato). In caso contrario compare un avviso permanente.
3. **Mondo non ricaricato dopo aver abilitato il modulo.** Ricarica con `F5` o riavvia il server Foundry.

**Vedo i nomi tradotti ma non le descrizioni (o viceversa)**

Babele traduce per chiave: se una voce è presente in `entries` ma manca una specifica proprietà (es. `description`), quella proprietà resta in inglese. Controlla il file `compendium/it/<pack>.json` corrispondente e apri una PR o issue con la proprietà mancante.

**Le specie Pokémon sono ancora in inglese**

È voluto: il pack `pokemon-actors` non viene tradotto. I nomi delle specie sono identici a livello internazionale dalla prima generazione.

**Console del browser (F12) utile al debug**

```js
// Verifica che Babele conosca il nostro modulo
game.babele.modules.filter(m => m.module === "pok-role-localization-it")
// Verifica la lingua del client
game.settings.get("core", "language")
// Verifica quali file Babele ha indicizzato dalla nostra directory
game.babele._files.filter(f => f.includes("pok-role-localization-it"))
// Verifica che il pack "moves" abbia ricevuto una traduzione
game.babele.packs.get("pok-role-system.moves")?.translations
```

## Limiti Attuali

Il modulo è volutamente onesto su cosa non fa:

- Non traduce i nomi delle specie Pokémon (pack `pokemon-actors`): sono identici a livello internazionale dalla prima generazione.
- Non sovrascrive Stati Alterati e Condizioni Meteo: se ne occupa già il sistema `pok-role-system`.
- Non modifica le regole, le meccaniche o l'automazione del sistema: è puro livello di localizzazione.
- Le traduzioni potrebbero contenere piccole imprecisioni o nomi regionali alternativi: aprire una issue o PR è il modo più rapido per farli correggere.

## Contribuire

Per segnalare nomi errati o proporre miglioramenti delle traduzioni:

- apri una issue: `https://github.com/LinguardEvergreen/pok-role-localization-it/issues`
- oppure invia una pull request direttamente sul file `compendium/it/*.json` interessato

La fonte di riferimento per i nomi canonici è la [Pokémon Central Wiki](https://wiki.pokemoncentral.it/).

## Crediti

- Sistema di base: [`Pok-Role-Module`](https://github.com/RiccardoMont1/Pok-Role-Module) di RiccardoMont1
- Framework di traduzione: [Babele](https://foundryvtt.com/packages/babele)
- Terminologia italiana: [Pokémon Central Wiki](https://wiki.pokemoncentral.it/)
- Regolamento: Pokérole 3.0

## Licenza

MIT.

Le denominazioni, immagini e concetti Pokémon sono di proprietà di Nintendo, Game Freak, Creatures Inc. e The Pokémon Company. Questo modulo è un progetto fan-made non ufficiale e non è affiliato con i titolari del marchio.
