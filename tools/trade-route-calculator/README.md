# Traveller Trade Route Calculator

A free static ship-computer interface for campaign trading, routes, cargo, accounts, freight/mail, and optional cargo insurance and taxes.

Open `index.html` through an HTTP server or GitHub Pages. No build, paid service, account, PDF access, or backend is required. Direct `file://` loading is unsupported because the app loads local JSON and JavaScript modules.

## Start a campaign

1. Choose **Set up campaign**, select your current sector, subsector and world, then enter ship, bank and starting date label.
2. Add existing cargo from **Cargo** without debiting the opening bank again.
3. **Find supplier** creates a market after an explicit search commit. Buy and sell through previews and explicit commits.
4. **Plot route** accepts mandatory stops in order. Clicking the map or Previous/Next only browses; **COMMIT JUMP** moves the ship and advances elapsed hours.
5. Use **Settings** for trader skills, profit mode, insurance and taxes. Both Merchant Prince options start off.
6. Export JSON backups regularly. The campaign is stored in this browser; it is not uploaded to GitHub or Traveller Map.

**Rules & Notes** contains source references, all 22 agreed interpretations, house rules and credits. [Verification evidence](RULES_VERIFICATION.md) distinguishes source/data checks from application tests.

## Features and boundaries

- Live Traveller Map worlds, clickable four-parsec local map, editable UWP/fuel/zone overrides and fewest-jumps route search. The search loads up to 12 parsecs around each requested stop and refuses to label an unconnected route valid. It is not an unlimited galaxy-wide optimizer.
- Separately tracked cargo lots, decimal tons, audited fees, per-lot profit adjustment, bank ledger and reversible actions. Money and quantity calculations use exact rational arithmetic.
- Full Core commodity table and per-commodity modifier audits. Exotics and local item-ban thresholds require referee input. Generated dice/results can be overridden with recorded reasons.
- Freight/mail capacity reservations, explicit delivery, late-freight penalties and duplicate-payout protection. Auto-generated contract prices use direct endpoint distance; manual contracts support alternative terms.
- Optional first-edition Merchant Prince insurance and per-sale tax adaptations. Criminal-market sales are tax-free; protection payments are manual expenses. Policies preserve original terms and require explicit amendments for changed routes.
- One editing tab at a time, stale-preview rejection, validated imports, recovery for corrupt saves and visible storage errors. Undo stores inverse changes instead of repeatedly copying the entire ledger.

Requires a current browser with JavaScript, localStorage, BigInt, structuredClone and Web Locks. A browser without safe locking stays read-only. World lookup requires an internet connection; saved campaign data and calculations remain local. Search boundaries, manual referee inputs and browser storage limits remain visible rather than generating guessed values.

The campaign display retains a starting date label plus exact elapsed days/hours. No Gregorian or other campaign-calendar conversion is inferred.

## Development and verification

From this folder, serve the files with any static server, for example:

```sh
python -m http.server 8765 --bind 127.0.0.1
```

Run the standard-library source/data checks and Node unit tests:

```sh
python verification/check_rules.py
node --test verification/app.test.mjs
```

The browser scripts use Playwright only for development testing; it is not an application dependency. With Playwright installed, run:

```sh
node verification/browser.test.mjs
node verification/live-map.test.mjs
```

An optional first argument supplies the path to an existing Playwright module. `TRAVELLER_BROWSER_CHANNEL=msedge` or `chrome` selects an installed browser; otherwise Playwright's bundled Chromium is used. `TRAVELLER_TEST_URL` overrides the local server URL, including a GitHub Pages subdirectory. Screenshots go to ignored `verification-artifacts/`.

The main browser test uses deterministic API fixtures based on a checked live response; the separate live test verifies actual browser access to Traveller Map. See [ARCHITECTURE.md](ARCHITECTURE.md), [REQUIREMENTS.md](REQUIREMENTS.md) and [BACKLOG.md](BACKLOG.md) for the specification and deferred scope.

## World selection and map

Find World, campaign setup, destinations and route stops use searchable **Sector → Subsector → World** dropdowns. World names include their hex; the hex is filled automatically. Route planning always starts at the actual ship location, with editable ordered stops. Nearby choices default to the current sector/subsector where possible.

**Recent worlds** remembers up to ten successfully selected worlds in this browser, deduplicated by sector/hex. This optional shortcut is a browser preference separate from campaign JSON backups; storage failure does not prevent world selection. Selecting a recent world fills the full chain but does not move the ship.

The local map includes a numbered hex grid with a **Show hexes** toggle. Numbers use sector-local coordinates, including when the map crosses a sector boundary. Grid lines and numbers do not block world clicks.

Lists come from the [Traveller Map public API](https://travellermap.com/doc/api): universe, sector metadata, tab-delimited sector worlds, and final world lookup. Failed list requests offer a retry; changing a parent choice clears dependent choices, and late responses cannot replace a newer selection.

Run `node verification/world-picker.test.mjs` for the selector, recent-world and grid browser checks, using the same Playwright settings as the other browser suites.
