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

- Live Traveller Map worlds, clickable twelve-parsec local map, editable UWP/fuel/zone overrides and fewest-jumps route search. The search loads up to 12 parsecs around each requested stop and refuses to label an unconnected route valid. It is not an unlimited galaxy-wide optimizer.
- Separately tracked cargo lots, decimal tons, audited fees, per-lot profit adjustment, bank ledger and reversible actions. Money and quantity calculations use exact rational arithmetic.
- Full Core commodity table and per-commodity modifier audits. Exotics and local item-ban thresholds require referee input. Generated dice/results can be overridden with recorded reasons.
- Freight/mail capacity reservations, explicit delivery, late-freight penalties and duplicate-payout protection. Auto-generated contract prices use direct endpoint distance; manual contracts support alternative terms.
- Optional first-edition Merchant Prince insurance and per-sale tax adaptations. Criminal-market sales are tax-free; protection payments are manual expenses. Policies preserve original terms and require explicit amendments for changed routes.
- One editing tab at a time, stale-preview rejection, validated imports, recovery for corrupt saves and visible storage errors. Undo stores inverse changes instead of repeatedly copying the entire ledger.

Requires a current browser with JavaScript, localStorage, BigInt, structuredClone and Web Locks. A browser without safe locking stays read-only. World lookup requires an internet connection; saved campaign data and calculations remain local. Search boundaries, manual referee inputs and browser storage limits remain visible rather than generating guessed values.

The campaign clock displays an Imperial day-year date and hour, starting at 001-1105 by default. It advances from the saved start date and elapsed hours using 24-hour days and 365-day years. Map data stays in the M1105 era regardless of elapsed campaign years. Older custom date labels remain readable until corrected through Campaign time. Calendar convention reference: [Imperial calendar overview](https://mail.freelancetraveller.com/features/culture/reference/calend.html).

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

**Auto plot** lets you click a destination on the map. **Build route** lets you click required stops in order, remove any chosen stop, or remove the last stop. Auto plot finds connecting stops using the jump rating in Settings and the existing fuel rules. Build route keeps exactly the worlds clicked, in order, without inserting or replacing stops. Invalid direct legs are flagged and must be corrected manually before saving. Review the preview and select **Save planned route** to confirm; Cancel planning leaves the saved route unchanged.

**Clear planned route** clears future stops and resets the plan to the ship's current actual world. It does not move the ship back to its original campaign starting world. Time, bank, cargo, insurance terms and completed travel history remain unchanged; Undo restores the previous plan. Only **COMMIT JUMP** travels along the route.

Run `node verification/click-route.test.mjs` for map route planning, removing stops, save/cancel, clear after travel, Undo, request failures and mobile layout checks.

Find World, campaign setup, destinations and route stops use searchable **Sector → Subsector → World** dropdowns. World names include their hex; the hex is filled automatically. Route planning always starts at the actual ship location, with editable ordered stops. Nearby choices default to the current sector/subsector where possible.

**Recent worlds** remembers up to ten successfully selected worlds in this browser, deduplicated by sector/hex. This optional shortcut is a browser preference separate from campaign JSON backups; storage failure does not prevent world selection. Selecting a recent world fills the full chain but does not move the ship.

The local map includes a numbered hex grid with a **Show hexes** toggle. Numbers use sector-local coordinates, including when the map crosses a sector boundary. Grid lines and numbers do not block world clicks.

Lists come from the [Traveller Map public API](https://travellermap.com/doc/api): universe, sector metadata, tab-delimited sector worlds, and final world lookup. Failed list requests offer a retry; changing a parent choice clears dependent choices, and late responses cannot replace a newer selection.

Run `node verification/world-picker.test.mjs` for the selector, recent-world and grid browser checks, using the same Playwright settings as the other browser suites.

## Map zoom and starting world

The default map view is closer, and hexes are restricted to the twelve-parsec neighborhood rather than filling the viewport with extra empty cells. Use the mouse wheel over the map or the + / − / Reset view controls to zoom from 20% to 240%. Zoom changes only the view; ordinary scrolling elsewhere and Ctrl+wheel browser zoom are preserved.

After Find World, **Use as starting world** opens an explicit confirmation. The same action is available on a browsed world's map panel. It sets the actual ship location, clears the old route, records a reason and supports Undo. It does not advance time or change bank/cargo/contract payments; active insurance is flagged for an amendment. Use COMMIT JUMP for normal travel.

Sector lists and world lookups explicitly use Traveller Map's M1105 milieu. Other-era versions are excluded and repeated sector names are deduplicated, so Trojan Reach appears once.

Nearby worlds within 12 hexes load automatically when setting the ship's starting world or reopening a saved campaign. Location changes wait for successful loading before committing. Zoom out to 20% to see the entire neighborhood; crowded world/hex labels simplify when zoomed out, with world names/hexes still available by hovering or selecting. Refresh nearby remains available for an explicit retry.

## Trade tables

Purchase offers show Retail (Core Rulebook base price), the 3D table Price %, and final Purchase Price per ton. Expired offers stay dimmed and auditable, with Buy disabled.

Cargo sale rows retain each lot's description and cost basis, even for the same commodity. Use Sell to negotiate; Price % and Sale Price then show that session's quote, with its inputs available through Audit. Before negotiation, the table says Not negotiated. Campaign changes invalidate these previews; committed sales retain their saved audits. Edit supports explicit, recorded lot corrections.

Freight and mail use a separate contract table with tons, destination, rate per ton, total contractual revenue, dates, status and row actions. Edit available offers before Accept; Audit/View preserves original calculations and overrides. Accepted contracts use the existing explicit delivery and payout workflow. Wide tables scroll horizontally on smaller panels and screens.


## Cabins, service and supplies

Ship settings combine crew and passenger cabins. Middle and high cabins each cost Cr1,000/month, including empty cabins. Enter total people and the subset receiving high service: middle costs Cr1,000/person/month; high costs Cr3,000, including upgraded middle-cabin occupants. These are campaign rates, explained in the form's rules note. High-service luggage defaults to one cargo ton per person, with an editable allowance; middle service reserves none. Luggage reduces available cargo capacity.

The main controls include **Refill life support**, and the ship summary shows remaining days. Configure capacity (default 28 days) and supplies actually aboard. Campaign time consumes supplies. Refill previews and purchases only missing stock using current cabin/person rates. Confirm local supply availability before paying. Undo restores stock and payment. Existing campaigns without recorded inventory must enter their actual supplies first. Manual Ship Expenses payments are separate accounting entries and do not refill tracked stock.

Run `node --test verification/life-support.test.mjs` and `node verification/combined-cabins.test.mjs` for stock and browser checks.
