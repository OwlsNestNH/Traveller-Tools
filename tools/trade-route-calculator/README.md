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
node verification/run-native.mjs
```

The native runner discovers every `node:test` suite; do not use `verification/*.test.mjs` with `node --test`, because that also selects the standalone browser scripts.

Pull requests run all native suites, the 198 rules-data checks, the shared tool-visit check, and seven independent deterministic Chromium suites: main application, modal lifecycle, click routing, fuel, empty space, Mail, and map overview. See `.github/workflows/mail-browser.yml` at the repository root. Every job verifies the exact PR head and uploads evidence; it has read-only permissions and cannot deploy. Live API availability and the remaining browser scripts are separate checks.

The browser scripts use Playwright only for development testing; it is not an application dependency. With Playwright installed, run:

```sh
node verification/browser.test.mjs
node verification/live-map.test.mjs
```

An optional first argument supplies the path to an existing Playwright module. `TRAVELLER_BROWSER_CHANNEL=msedge` or `chrome` selects an installed browser; otherwise Playwright's bundled Chromium is used. `TRAVELLER_TEST_URL` overrides the local server URL, including a GitHub Pages subdirectory. Screenshots go to ignored `verification-artifacts/`.

The main browser test uses deterministic API fixtures based on a checked live response; the separate live test verifies actual browser access to Traveller Map. See [ARCHITECTURE.md](ARCHITECTURE.md), [REQUIREMENTS.md](REQUIREMENTS.md) and [BACKLOG.md](BACKLOG.md) for the specification and deferred scope.

## World selection and map

**Auto plot** lets you click a destination on the map. **Build route** lets you click required stops in order, remove any chosen stop, or remove the last stop. Auto plot finds connecting stops using the jump rating in Settings, preferring longer legs first when jump counts tie, then stable world IDs. Unconfirmed fuel produces a warning and does not change route ranking under the approved campaign override. Build route keeps exactly the worlds clicked, in order, without inserting or replacing stops. Invalid direct legs are flagged and must be corrected manually before saving. Review the preview and select **Save planned route** to confirm; Cancel planning leaves the saved route unchanged.

**Clear planned route** clears future stops and resets the plan to the ship's current actual world. It does not move the ship back to its original campaign starting world. Time, bank, cargo, insurance terms and completed travel history remain unchanged; Undo restores the previous plan. Only **COMMIT JUMP** travels along the route.

Run `node verification/click-route.test.mjs` for map route planning, removing stops, save/cancel, clear after travel, Undo, request failures and mobile layout checks.

Find World, campaign setup, destinations and route stops use searchable **Sector → Subsector → World** dropdowns. World names include their hex; the hex is filled automatically. Route planning always starts at the actual ship location, with editable ordered stops. Nearby choices default to the current sector/subsector where possible.

**Recent worlds** remembers up to ten successfully selected worlds in this browser, deduplicated by sector/hex. This optional shortcut is a browser preference separate from campaign JSON backups; storage failure does not prevent world selection. Selecting a recent world fills the full chain but does not move the ship.

The local map includes a numbered hex grid with a **Show hexes** toggle. Numbers use sector-local coordinates, including when the map crosses a sector boundary. Grid lines and numbers do not block world clicks.

Lists come from the [Traveller Map public API](https://travellermap.com/doc/api): universe, sector metadata, tab-delimited sector worlds, and final world lookup. Failed list requests offer a retry; changing a parent choice clears dependent choices, and late responses cannot replace a newer selection.

Run `node verification/world-picker.test.mjs` for the selector, recent-world and grid browser checks, using the same Playwright settings as the other browser suites.

## Map zoom and starting world

The default map view is closer, and hexes are restricted to the twelve-parsec neighborhood rather than filling the viewport with extra empty cells. Use the mouse wheel over the map or the + / − / Reset view controls to zoom from 6% to 240%. Zoom changes only the view; ordinary scrolling elsewhere and Ctrl+wheel browser zoom are preserved.

After Find World, **Use as starting world** opens an explicit confirmation. The same action is available on a browsed world's map panel. It sets the actual ship location, clears the old route, records a reason and supports Undo. It does not advance time or change bank/cargo/contract payments; active insurance is flagged for an amendment. Use COMMIT JUMP for normal travel.

Sector lists and world lookups explicitly use Traveller Map's M1105 milieu. Other-era versions are excluded and repeated sector names are deduplicated, so Trojan Reach appears once.

Nearby worlds within 12 hexes load automatically when setting the ship's starting world or reopening a saved campaign. Location changes wait for successful loading before committing. Zoom out to 20% to see the entire neighborhood; crowded world/hex labels simplify when zoomed out, with world names/hexes still available by hovering or selecting. Refresh nearby remains available for an explicit retry.

## Trade tables

Purchase offers show Retail (Core Rulebook base price), the 3D table Price %, and final Purchase Price per ton. Expired offers stay dimmed and auditable, with Buy disabled.

Cargo sale rows retain each lot's description and cost basis, even for the same commodity. Use Sell to negotiate; Price % and Sale Price then show that session's quote, with its inputs available through Audit. Before negotiation, the table says Not negotiated. Campaign changes invalidate these previews; committed sales retain their saved audits. Edit supports explicit, recorded lot corrections.

Freight and mail use a separate contract table with tons, destination, rate per ton, total contractual revenue, dates, status and row actions. Edit available offers before Accept; Audit/View preserves original calculations and overrides. Accepted contracts use the existing explicit delivery and payout workflow. Wide tables scroll horizontally on smaller panels and screens.


## Cabins, service and supplies

Ship settings combine crew and passenger cabins. Middle and high cabins each cost Cr1,000/month, including empty cabins. Enter separate middle-service and high-service people counts; the total is their sum: middle costs Cr1,000/person/month; high costs Cr3,000, including upgraded middle-cabin occupants. These are campaign rates, explained in the form's rules note. High passenger luggage is automatically one cargo ton per High passenger; middle passengers reserve none. An optional override changes the total luggage tonnage, never a per-person multiplier. Luggage reduces available cargo capacity.

The main controls include **Refill life support**, and the ship summary shows remaining days. Configure capacity (default 28 days) and supplies actually aboard. Campaign time consumes supplies. Refill previews and purchases only missing stock using current cabin/person rates. Confirm local supply availability before paying. Undo restores stock and payment. Existing campaigns without recorded inventory must enter their actual supplies first. Manual Ship Expenses payments are separate accounting entries and do not refill tracked stock.

Run `node --test verification/life-support.test.mjs` and `node verification/combined-cabins.test.mjs` for stock and browser checks.

## Daily time controls

Use **-1 day** or **+1 day** beside Campaign time. Advancing consumes 24 hours of recorded life support, stopping at zero. Moving the date backward does not restore supplies or reverse transactions, and cannot move before campaign start. Both actions appear in History (Settings filter). Undo reverses an accidental advance and restores the date and supplies together. Controls respect editing locks and save immediately.

Run `node verification/day-controls.test.mjs` for date boundaries, stock use, History, undo, persistence, read-only tabs and mobile layout.

Life support uses whole days. Short activities accumulate internally until 24 hours have elapsed, then one day is consumed. Refilling rounds any partly used day up, resets the partial-day counter and leaves campaign time unchanged. Settings, refill previews and TXT reports display whole days. Saving unrelated ship settings preserves the partial-day counter; changing the recorded stock starts a new counter. Historical charges remain unchanged.

## Jump fuel tracking

Enter total **Ship displacement**, **Jump-fuel tank capacity**, and **Jump fuel aboard** in setup or Ship settings. Displacement is separate from cargo capacity; tank figures cover jump fuel only. Power-plant consumption is excluded. Older campaigns remain untracked until their actual figures are entered. Entering initial fuel or correcting stock in settings does not charge the bank.

Ship expenses suggests the deficit for the next planned jump, or the empty tank space when there is no next leg. **Fuel for next jump** and **Fill tank** set an editable purchase quantity. Purchased refined fuel costs Cr500/ton; purchased unrefined Cr100/ton; confirmed natural water collection remains free under existing availability rules. Confirming adds fuel to the tank and records a readable before/after audit; overfilling and unaffordable purchases are rejected.

A committed jump consumes 10% of total hull tonnage per actual parsec, rounded up to whole tons, with a minimum Jump-1 expenditure. A 200-ton ship uses 20 tons for one parsec and 40 for two. Under the approved campaign override, insufficient aboard fuel warns but does not block a jump. The commit consumes available fuel down to zero and records the required amount, consumed amount and shortfall. Browsing, planning and cancelled previews consume none. Undo restores fuel along with the transaction or jump. Fuel type is recorded per purchase; grade mixing, refining, unrefined-fuel jump penalties and power-plant fuel are resolved outside this tool.

Source: Core Rulebook Update 2022, p. 157 (jump consumption), p. 154 (prices); p. 180 distinguishes jump and power-plant tankage. Run `node --test verification/fuel.test.mjs` and `node verification/fuel-browser.test.mjs`.

A **Refuel** panel sits beside Life support. Refined, Unrefined and Collect water radio buttons select the source; **Refuel** opens a fuel-only Ship expenses preview, initially set to fill the tank. Selecting a source never charges the bank. Missing ship fuel settings open setup before refuelling. On narrow screens the two panels stack.

## Optional reduced-profit price limits

In **Ship, trader & options**, **Enable reduced-profit price limits** starts off. **Minimum buy · % of base retail** defaults to 85; **Maximum sell · % of base retail** defaults to 115. Separate native number inputs offer one-percentage-point steps. Both accept whole percentages from 0 through 400 (covering the RAW table range and allowing stricter custom floors/ceilings); they are independent, so minimum buy need not be below maximum sell. Blank, fractional, nonfinite and out-of-range values are rejected.

The enabled option floors the generated purchase percentage and ceilings the generated sale percentage before converting to Credits, rounding, and calculating broker fees. The applicable base retail still comes from the independent commodity cap and illegal-goods RAW exception. Disabling this option restores the existing RAW quote formula; the existing 75%/Custom positive-profit adjustment remains separate and unchanged.

Custom values remain editable and persist through off/on toggles, reload, JSON export/import and Undo. Legacy schema-1 campaigns receive disabled defaults without changing historical prices. New quotes use the option; saved supplier offers keep their frozen terms, including when recalculated using their saved options. Explicit referee price overrides remain available and auditable. Audits retain both the RAW table percentage and the effective percentage before fees; the table's Price % shows the effective quote percentage.

Run the focused checks with `node --test verification/price-limits.test.mjs`, alongside the existing development checks above. Browser operation and native stepper appearance need browser verification.


## Wide map layers

The existing world views at **20–240%** are unchanged, including maximum-zoom UWP labels. Zooming below 20% adds a **subsector view** with real subsector names and faint world dots. Below 16%, the **sector view** prioritizes sector names, readable A–P subsector letters and a subtle subdivision grid. Sector and subsector names tilt 45° to use the diagonal space; A–P letters remain upright and avoid the name. Long names fit or wrap within their cell. The widest scale is 6%; the 20% boundary remains a reachable step on the + / − controls. Reset view still returns to the centered 100% world view.

Both wide layers use the same drag-to-pan camera. They are orientation views: zoom back in to select worlds or route stops. They do not change the ship, route, clock, bank, cargo or saved campaign. Sector coordinates and names come from Traveller Map's M1105 universe; named subsectors and world dots come from its metadata and sector tables. Unnamed subsectors show their official letter only. Failed requests remain retryable with Refresh nearby.

Overview data is separate from campaign and route-search data. The overview fetches only visible sectors, limits loading to two HTTP requests at a time, retains at most 48 sector records, and discards superseded loading queues. With Political territory off, the widest layer needs only the universe catalog. With the overlay on, it loads sector metadata without requesting world tables.

Run `node --test verification/map-overview.test.mjs verification/map-viewport.test.mjs` for layer boundaries, coordinates, camera continuity, M1105 parsing, and cache/race checks. Run `node verification/map-overview-browser.test.mjs` for the new layers, both preserved world views, retry, pan/cancel/reset, mobile and campaign invariants. Its compact fixture is sampled from live Traveller Map M1105 responses retrieved on 2026-10-08.


**Political territory** is one optional toggle at every zoom level. It starts on and remembers your on/off choice in this browser, separately from campaign JSON. Redraws, campaign imports and resets preserve that choice; reloads restore it when browser storage is available. If preference storage is unavailable, the toggle still works for the current session. Faint allegiance colors and restrained borders follow Traveller Map's M1105 border hex paths, including sector-edge continuations; they do not color whole subsectors or infer territory from world allegiance. Regions unrelated to political borders are excluded. Missing border metadata leaves the area unshaded, which does not imply unclaimed space. Names, dots and the subdivision grid stay above the overlay. The tint sits beneath world names, UWPs, hexes and routes at close zoom. Toggling it never changes the campaign, selected world, route or camera; the original close-up details and interactions are preserved.

Run `node --test verification/map-preferences.test.mjs` for preference defaults, persistence and storage-failure checks.

Run `node --test verification/map-territory.test.mjs` for actual hex-edge geometry, parity, exact sector footprint, cross-sector continuity, one-hex/retraced/unclosed borders, safe styles and live-data coverage. Border geometry adapts [Traveller Map's renderer](https://github.com/inexorabletash/travellermap/blob/main/server/RenderUtil.cs) under Apache-2.0; the notice and full license are included in `licenses/`.


## Mail check

In **Contracts → Freight & mail**, the dedicated **Mail** card offers **Check for mail** without generating freight lots. Choose a destination and review the search roll/skills; freight traffic DM and the mail freight-band DM are calculated automatically. The card shows availability, the rolled container count, tons, delivery payment and whether the entire consignment fits in the remaining hold. **How was this calculated?** expands the search dice, endpoint population/port/TL/zone modifiers, distance, search Effect, mail-band, armed-ship, origin low-tech, highest Naval/Scout rank and highest SOC DMs. Existing Settings supply the armed/rank/SOC values; the card provides a shortcut to edit them.

Leave the separate **Mail availability · 2D total** and **Mail containers · 1D roll** fields blank for automatic rolls, or enter physical/manual dice. The container die is only used after a successful availability check. **Find contracts** still generates freight and mail together, with the same separate optional mail inputs; its existing sequence override remains supported. A separate mail total replaces that roll without consuming sequence dice.

Rules remain Core Rulebook Update 2022 pp. 240–241, INT-002/004: 2D plus DMs must reach 12; 1D containers each occupy 5 tons and pay Cr25,000 on explicit destination delivery. Mail is available to check independently of freight’s 1–6 parsec payment table. No guessed freight rate, mail deadline, automatic payment or late-mail penalty is added. Acceptance is all-or-none and reserves hold space; delivery releases it and can pay only once. Existing referee term overrides and Undo remain available.

Unaccepted offers stay in this session only. Reloading does not restore actionable offers from History. Accepted contracts persist normally, and historical checks remain read-only. A new standalone mail check replaces the session’s previous unaccepted mail offer while keeping its freight offers. Undoing a mail check discards that session’s mail offer; undoing a combined search or offer edit discards affected session offers rather than rebuilding older ones from History.

Run `node --test verification/mail.test.mjs verification/mail-ui.test.mjs` for rule boundaries, lifecycle and native UI/control checks. The latter uses a simulated DOM; it is not browser or visual verification.


### Mail browser CI

The **Mail browser checks** GitHub Actions workflow checks out the exact PR head and runs focused Mail tests in real Chromium. It uses a loopback-only static server, fresh synthetic campaigns and deterministic Traveller Map fixtures; it does not publish the app or access player campaign data. The workflow has only `contents: read`, disables saved checkout credentials, uses commit-pinned official GitHub actions and installs Playwright 1.58.2. Screenshots, per-case traces, a JSON summary, source-data/native logs and the tested commit are retained as an Actions artifact for 14 days.

To run the browser check locally with Playwright installed, start the static server described above, then run `node verification/mail-browser.test.mjs`. An optional argument supplies an installed Playwright module path, as in the other browser scripts. `TRAVELLER_TEST_URL` sets the server address; `TRAVELLER_COMMIT` labels the report. Browser results are separate from simulated-DOM tests and from the two existing native routing failures documented in RULES_VERIFICATION.md.


### Visible Mail rolls and Audit

The Mail result now shows the recorded availability dice/total, combined DM and final result against 12+ without opening details. The container roll is shown when recorded. **Audit** opens a read-only view of the saved search inputs, each endpoint’s population/port/TL/zone values and DMs, distance, search Effect, freight-band conversion, armed-ship, origin low-tech, rank and SOC modifiers, including zeroes and rule references. **How was this calculated?** stays available. New checks snapshot these inputs so later Settings or world edits do not rewrite the audit.

Mail contract rows retain the visible roll summary after acceptance, delivery and reload, using their saved audits; older missing rolls or inputs are labeled not recorded. No historical dice are recreated and no unaccepted offers are restored from History.

**Check for mail** sits beside **Manual contract** in the Freight & mail action row; both use the same light-blue style. Accepted/delivered Mail details can collapse while the recorded roll, outcome, route and Audit stay visible. Expanding shows saved shipment details and the current Settings shortcut again. The collapse choice is session-only, survives tab changes and does not alter campaign data; a new check starts expanded.

### Cancel Mail before departure

Accepted Mail now offers **Cancel mail** in its shipment details and saved contract row. Confirm **Cancel mail and start over** to release that whole consignment's hold space without payment or penalty, then use **Check for mail** for a fresh result. Other contracts and freight offers stay unchanged. The cancelled contract, saved dice, terms and cancellation audit remain visible; **Undo latest change** restores the consignment and its capacity reservation together.

Cancellation is available only before that Mail's first committed jump. Even a zero-hour jump closes it; returning to the origin, replacing the route or correcting the date/location does not reopen it. Undoing that jump restores its prior eligibility. Delivered Mail cannot be cancelled. Read-only tabs cannot commit cancellations, and an outdated confirmation must be reopened.

New accepted Mail saves an explicit departure marker in the jump transaction, including through JSON export/import. Older contracts without that marker are cancellable only when their complete, consistent acceptance/Undo/jump trail proves they have not departed. Missing or ambiguous older history displays **Travel history unverified** and disables cancellation. Older imported campaigns may have revision discontinuities that prevent this proof; the app does not guess from the ship's current location or date. Existing schema-1 campaigns remain readable without silently assigning an unrecorded departure state.

Run `node --test verification/mail-reset.test.mjs verification/mail-ui.test.mjs` for state/import/Undo and actual-app lifecycle checks. `verification/mail-browser.test.mjs` extends the existing real Chromium gate with cancellation, history, ownership, return travel and JSON-import flows.
