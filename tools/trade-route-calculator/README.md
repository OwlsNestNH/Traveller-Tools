# Traveller Ship Operations

A free static ship-computer interface for campaign trading, routes, cargo, accounts, freight/mail, and optional cargo insurance and taxes.

Open `index.html` through an HTTP server or GitHub Pages. No build, paid service, account, PDF access, or backend is required. Direct `file://` loading is unsupported because the app loads local JSON and JavaScript modules.

## Start a campaign

1. Choose **Set up campaign**, select your current sector, subsector and world, then enter ship, bank and starting date label.
2. Add existing cargo from **Cargo** without debiting the opening bank again.
3. Open **Trade**. **Find supplier** creates a market after an explicit search commit. Buy and sell through previews and explicit commits.
4. **Plot route** accepts mandatory stops in order. Clicking the map or Previous/Next only browses; **Jump to [next destination]** above the route opens the existing **COMMIT JUMP** confirmation, which moves the ship one leg and advances elapsed hours.
5. Use **Settings** for trader skills, profit mode, insurance and taxes. Both Merchant Prince options start off.
6. Export JSON backups regularly. The campaign is stored in this browser; it is not uploaded to GitHub or Traveller Map.

**Rules & Notes** contains source references, all 22 agreed interpretations, house rules and credits. [Verification evidence](RULES_VERIFICATION.md) distinguishes source/data checks from application tests.

## Features and boundaries

- Live Traveller Map worlds, clickable twelve-parsec local map, editable UWP/fuel/zone overrides and fewest-jumps route search. The search loads up to 12 parsecs around each requested stop and refuses to label an unconnected route valid. It is not an unlimited galaxy-wide optimizer.
- Separately tracked cargo lots, decimal tons, audited fees, per-lot profit adjustment, bank ledger and reversible actions. Money and quantity calculations use exact rational arithmetic.
- Full Core commodity table and per-commodity modifier audits. Exotics and local item-ban thresholds require referee input. Generated dice/results can be overridden with recorded reasons.
- Freight/mail capacity reservations, explicit delivery, late-freight penalties and duplicate-payout protection. Auto-generated contract prices use direct endpoint distance; manual contracts support alternative terms.
- Optional first-edition Merchant Prince insurance and per-sale tax adaptations. Criminal-market sales are tax-free; protection payments are manual expenses. Policies preserve original terms and require explicit amendments for changed routes. Saved insurance OFF hides purchase and held-cargo coverage controls and blocks new policies; existing policies, claims, amendments and History remain available. Enable new coverage explicitly in Settings.
- **Undo Jump** beside the next-jump control restores the departure world and all pre-jump travel state. One mulligan is available per departure before any later campaign change. The next initiation receives one fresh roll; Cancel, reopening, reload, route edits and History Undo do not reset that allowance. Original and replacement dice stay in the audit trail, while transient previews are cleared. Older jumps require a complete retained audit for the dedicated control.
- One editing tab at a time, stale-preview rejection, validated imports, recovery for corrupt saves and visible storage errors. Undo stores inverse changes instead of repeatedly copying the entire ledger.

Requires a current browser with JavaScript, localStorage, BigInt, structuredClone and Web Locks. A browser without safe locking stays read-only. World lookup requires an internet connection; saved campaign data and calculations remain local. Search boundaries, manual referee inputs and browser storage limits remain visible rather than generating guessed values.

The campaign clock displays an Imperial day-year date and hour, starting at 001-1105 by default. It advances from the saved start date and elapsed hours using 24-hour days and 365-day years. Map data stays in the M1105 era regardless of elapsed campaign years. Older custom date labels remain readable until corrected through Campaign time. Calendar convention reference: [Imperial calendar overview](https://mail.freelancetraveller.com/features/culture/reference/calend.html).

## Development and verification

[GUI_PARITY.md](GUI_PARITY.md) tracks the existing controls, future homes and acceptance checks for the planned GUI refit. Stage 1 implements the shared status/navigation shell and map-first Overview. The later Trade and secondary-page visual refits remain separate work.

From this folder, serve the files with any static server, for example:

```sh
python -m http.server 8765 --bind 127.0.0.1
```

Run the standard-library source/data checks and Node unit tests:

```sh
python verification/check_rules.py
node verification/run-native.mjs
```

The public display name is **Traveller Ship Operations**. The existing `tools/trade-route-calculator/` URL, browser storage keys and schema-1 JSON backups remain compatible.

The Planned route heading, Jump/Undo Jump controls and wrapping stop list share a thin content-sized border. It grows with longer routes and returns to its compact height when stops are removed; the map keeps its existing zoom and pan.

**Expand map** widens the entire navigation unit across the Overview and makes its map taller. It reveals more geography at the same zoom, world spacing and camera center; route, Jump/Undo and map controls keep their normal size. **Restore panels** returns to the normal layout and prior World data, Cargo Hold, expense overview or paid receipt. Expansion is a temporary view choice; reloading returns to the normal layout. Opening a ship service or another main tab also leaves the expanded view.

An unpaid service asks before expansion discards its unsaved changes, using the same cleanup as Back. Cancel keeps the draft intact; a saving payment must finish first. Paid receipts remain in the ledger, are restored without another charge, and can still reopen after a reload while expanded. Expansion alone does not save a campaign change.

Switching between World data, Refuel, Refill life support, Cargo Hold and Ship expenses keeps the same map dimensions and outer MFD frame. The map and right screen align at both ends on desktop; taller screen contents scroll inside the right panel. On smaller screens they stay stacked, with a consistent viewport-responsive right-screen height and all controls reachable by scrolling.

The four service buttons show their selected state. Clicking the selected button again returns to World data; selecting a different one switches directly. This uses the same draft cleanup as Back: unconfirmed input is discarded, paid transactions remain in the ledger, and no payment is repeated or reversed. A payment already saving must finish before leaving. Closing a paid receipt also clears its reload navigation preference without deleting the receipt.

The native runner discovers every `node:test` suite; do not use `verification/*.test.mjs` with `node --test`, because that also selects the standalone browser scripts.

Pull requests run all native suites, the 227 rules-data checks, the shared tool-visit check, and thirty-one independent deterministic Chromium suites: main application, modal lifecycle, click routing, fuel, empty space, Mail, map overview, GUI parity, Trade buttons, Settings, insurance lifecycle, trade complications, the selected-world screen, jump mulligans, in-panel ship services, combined cabins, daily time controls, zero-fuel payments, resource alerts, recurring payment batches, the compact Expenses panel, the Cargo Hold manifest, route frame/title, inline fuel/full-stock service controls, stable service-panel navigation, passenger contracts, ordered route selections/keyboard errors, legality/fractional-sales regressions, global planet-name search, direct-ton bladder capacity, and grouped contact-search periods. See `.github/workflows/mail-browser.yml` at the repository root. Every job verifies the exact PR head and uploads evidence; it has read-only permissions and cannot deploy. Live API availability and the remaining browser scripts are separate checks.

The browser scripts use Playwright only for development testing; it is not an application dependency. With Playwright installed, run:

```sh
node verification/browser.test.mjs
node verification/live-map.test.mjs
```

An optional first argument supplies the path to an existing Playwright module. `TRAVELLER_BROWSER_CHANNEL=msedge` or `chrome` selects an installed browser; otherwise Playwright's bundled Chromium is used. `TRAVELLER_TEST_URL` overrides the local server URL, including a GitHub Pages subdirectory. Screenshots go to ignored `verification-artifacts/`.

The main browser test uses deterministic API fixtures based on a checked live response; the separate live test verifies actual browser access to Traveller Map. See [ARCHITECTURE.md](ARCHITECTURE.md), [REQUIREMENTS.md](REQUIREMENTS.md) and [BACKLOG.md](BACKLOG.md) for the specification and deferred scope.

## World selection and map

**Auto plot** lets you click a destination on the map. **Build route** lets you click required stops in order, remove any chosen stop, or remove the last stop. Auto plot finds connecting stops using the jump rating in Settings, preferring longer legs first when jump counts tie, then stable world IDs. Unconfirmed fuel produces a warning and does not change route ranking under the approved campaign override. Build route keeps exactly the worlds clicked, in order, without inserting or replacing stops. Invalid direct legs are flagged and must be corrected manually before saving. Review the preview and select **Save planned route** to confirm; Cancel planning leaves the saved route unchanged.

**Clear planned route** clears future stops and resets the plan to the ship's current actual world. It does not move the ship back to its original campaign starting world. Time, bank, cargo, insurance terms and completed travel history remain unchanged; Undo restores the previous plan. Only the explicit **COMMIT JUMP** confirmation travels one leg along the route.

Run `node verification/click-route.test.mjs` for map route planning, removing stops, save/cancel, clear after travel, Undo, request failures and mobile layout checks.

Pending hex lookups reserve their clicked position immediately and block Save until checked. A failed lookup stays in the plan for **Retry route** or **Remove stop**. Auto plot uses only the newest selected destination; late responses cannot replace it. Enter and Space on map controls report lookup failures through the same visible error path as mouse clicks. Run `node --test verification/route-selection.test.mjs` for source-executed ordering/lifecycle checks and `node verification/route-selection-browser.test.mjs` for deterministic Chromium interaction regressions.

Find World also supports a **Planet name** search across all sectors, without choosing a sector or subsector. Enter two or more characters, then wait briefly or press Enter / **Search planets**. Matching planets show **Planet — Subsector — Sector — Hex**, so repeated names remain distinct. Select a result to browse its highlighted world and neighborhood. The ship, origin, saved route, time and transactions stay unchanged. **Current system** returns to the ship. The existing **Use as starting world** action still requires its separate confirmation.

Search uses Traveller Map’s M1105 world-only search and genuine sector metadata for subsector names. Missing names show the subsector letter and “name unavailable”; no name is guessed. Broad searches are capped at 160 results and explain when to refine the name. Search/lookup errors can be retried. Changing the query or closing the dialog makes pending results inert.

Find World, campaign setup, destinations and route stops use searchable **Sector → Subsector → World** dropdowns. World names include their hex; the hex is filled automatically. Route planning always starts at the actual ship location, with editable ordered stops. Nearby choices default to the current sector/subsector where possible.

**Recent worlds** remembers up to ten successfully selected worlds in this browser, deduplicated by sector/hex. This optional shortcut is a browser preference separate from campaign JSON backups; storage failure does not prevent world selection. Selecting a recent world fills the full chain but does not move the ship.

The local map keeps the numbered hex grid on without a visible toolbar toggle. Numbers use sector-local coordinates, including when the map crosses a sector boundary. Grid lines and numbers do not block world clicks.

Lists come from the [Traveller Map public API](https://travellermap.com/doc/api): universe, sector metadata, tab-delimited sector worlds, and final world lookup. Failed list requests offer a retry; changing a parent choice clears dependent choices, and late responses cannot replace a newer selection.

Run `node verification/world-picker.test.mjs` for the selector, recent-world and grid browser checks, using the same Playwright settings as the other browser suites.

## Map zoom and starting world

At 100% zoom, neighboring hex rows are 50 CSS pixels apart. The map adapts its visible bounds to the available space without changing zoom or the geographic center. Its logical width follows the available screen width, with uniform projection, clipping and live map-area loading; narrow screens retain map height instead of squashing geography. Hold Ctrl while scrolling over the map, or use the + / − / Reset view controls, to zoom from 6% to 288%. The existing 240% close view stays reachable; one more + step reaches 288%, and one − step returns to 240%. Both close views keep the same readable UWP labels and symbols, with more space between worlds. Zooming preserves the geographic center and browsed-world selection in normal and expanded layouts. The visible label says **Ctrl + scroll to zoom.** Plain wheel scrolling over the map moves the page without changing map zoom. Ctrl+wheel is intercepted only over the map; browser behavior elsewhere is unchanged. Map zoom changes only the view. Existing single-pointer/touch dragging is unchanged; this app has no dedicated two-finger touchscreen pinch handler.

After Find World, **Use as starting world** opens an explicit confirmation. The same action is available on a browsed world's map panel. It sets the actual ship location, clears the old route, records a reason and supports Undo. It does not advance time or change bank/cargo/contract payments; active insurance is flagged for an amendment. Use COMMIT JUMP for normal travel.

Sector lists and world lookups explicitly use Traveller Map's M1105 milieu. Other-era versions are excluded and repeated sector names are deduplicated, so Trojan Reach appears once.

Nearby worlds within 12 hexes load automatically when setting the ship's starting world or reopening a saved campaign. Location changes wait for successful loading before committing. Zoom out to 20% to see the entire neighborhood; crowded world/hex labels simplify when zoomed out, with world names/hexes still available by hovering or selecting. Refresh nearby remains available for an explicit retry.

## Trade tables

Purchase offers show Retail (Core Rulebook base price), the 3D table Price %, and final Purchase Price per ton. Expired offers stay dimmed and auditable, with Buy disabled.

Cargo sale rows retain each lot's description and cost basis, even for the same commodity. Use Sell to negotiate; Price % and Sale Price then show that session's quote, with its inputs available through Audit. Before negotiation, the table says Not negotiated. Campaign changes invalidate these previews; committed sales retain their saved audits. Edit supports explicit, recorded lot corrections.

Freight and mail use a separate contract table with tons, destination, rate per ton, total contractual revenue, dates, status and row actions. Edit available offers before Accept; Audit/View preserves original calculations and overrides. Accepted contracts use the existing explicit delivery and payout workflow. Wide tables scroll horizontally on smaller panels and screens.


## Contact-search periods

Buyer and supplier searches share a per-planet penalty: DM −1 per earlier committed attempt in the current grouped 28-day (672-hour) period. The first committed search anchors that period at its start time; all penalties clear together at the exact reset hour, and the next committed search starts the next period. Changing counterparties, search methods or leaving and revisiting the planet does not reset the count. Failed searches count; previews and cancellations do not. A search that finishes after reset still uses its start-time penalty.

This is a **Home Rule / campaign interpretation** of Core’s “same month” wording. The form shows the current period and reset date; new History audits preserve the period and penalty. Legacy snapshots are replayed in saved commit order without rewriting their historic rolls, totals, prices or Undo records. Each new period uses its first committed search’s start time; backward clock corrections do not discard the latest committed group. Reject-deal cooldowns remain 720 hours.

Run `node --test verification/contact-search.test.mjs verification/contact-search-ui.test.mjs` and `node verification/contact-search-browser.test.mjs` for boundary, migration, persistence, cancellation, shared-count and Undo checks.

## Cabins, service and supplies

Ship settings combine crew and passenger cabins. Middle and high cabins each cost Cr1,000/month, including empty cabins. Enter separate middle-service and high-service people counts; the total is their sum: middle costs Cr1,000/person/month; high costs Cr3,000, including upgraded middle-cabin occupants. These are campaign rates, explained in the form's rules note. High passenger luggage is automatically one cargo ton per High passenger; middle passengers reserve none. An optional override changes the total luggage tonnage, never a per-person multiplier. Luggage reduces available cargo capacity.

**Refill life support** replaces the Overview World data screen. Summary → Adjust → Review → Confirm is a draft-only flow until final confirmation. The map stays usable. Browsing another world never changes the service location or prices: the actual ship location is shown prominently. Back, Cancel and Escape discard the draft. Campaign mutations pause until the draft is closed; revision and editor-ownership checks prevent stale or duplicate payment.

Life support is one exact physical LSS balance: an awake person uses 1 unit/day, an actual occupied low berth uses 0.1. Enter frozen occupants separately from awake Middle/High people; crew are included once. All stock first occupies internal stores of 4 × hull displacement; only overflow uses cargo at 0.01 ton/LSS. Fractional hourly consumption and cargo reservations remain exact. The standard refill target (default 28 days) is separate from storage capacity. Physical reference: Cluster Truck, p. 14.

Ordinary top-ups to the standard target keep existing cabin/person bundle rates. Extra stock beyond that target uses the Home rule: Cr1,000 per person-equivalent per 28 days, with frozen occupants counting 0.1, then one combined roundup to Cr100. Already-aboard stock is credited before quoting either portion. Optional comfort spending requires a note and adds no supplies, days or capacity. Refills check available cargo and Credits before the final confirmation. One Undo restores stock, cargo reservation and payment together.

Legacy days are converted using the recorded complement and actual partial-day remainder inside the next undoable action. Loads/imports never rewrite historic prices or Undo patches. Unknown/zero-complement legacy stock remains unconverted and needs an explicit actual LSS correction; missing hull displacement preserves saved inventory but blocks new purchases until storage can be determined. Settings keep stock unchanged when the complement changes; editing recorded days or entering actual LSS is an explicit correction.

Run `node --test verification/life-support.test.mjs verification/service-panels.test.mjs` and `node verification/service-panels-browser.test.mjs` for model and browser coverage.

## Daily time controls

Use **-1 day** or **+1 day** beside Campaign time. Advancing consumes 24 hours of recorded life support, stopping at zero. Moving the date backward does not restore supplies or reverse transactions, and cannot move before campaign start. Both actions appear in History (Settings filter). Undo reverses an accidental advance and restores the date and supplies together. Controls respect editing locks and save immediately.

Run `node verification/day-controls.test.mjs` for date boundaries, stock use, History, undo, persistence, read-only tabs and mobile layout.

Life support consumption is exact for each elapsed hour at the current complement. Time corrections backward do not invent supplies. Refilling changes physical stock without advancing campaign time. Settings and TXT reports show LSS, derived endurance, internal storage and cargo overflow. Historical charges remain unchanged.

## Jump fuel tracking

Enter total **Ship displacement**, **Base fuel tank capacity**, and **Fuel aboard** in setup or Ship settings. Displacement is separate from cargo capacity. Enter the total base tank capacity you want tracked, including any power-plant or small-craft allowance; optional bladders are added separately. Power-plant and small-craft use are not tracked separately. Older campaigns remain untracked until their actual figures are entered. Entering initial fuel or correcting stock in settings does not charge the bank.

Ship expenses suggests the deficit for the next planned jump, or the empty tank space when there is no next leg. **Fuel for next jump** and **Fill tank** set an editable purchase quantity. Purchased refined fuel costs Cr500/ton; purchased unrefined Cr100/ton; water collection is always available at zero cost; hydrographics or missing planet information only produces an advisory warning. Purchased fuel availability still requires an explicit supplier override and source note outside standard starport supply. Confirming adds fuel to the tank and records a readable before/after audit; overfilling and unaffordable purchases are rejected.

A committed jump consumes 10% of total hull tonnage per actual parsec, rounded up to whole tons, with a minimum Jump-1 expenditure. A 200-ton ship uses 20 tons for one parsec and 40 for two. Under the approved campaign override, insufficient aboard fuel warns but does not block a jump. The commit consumes available fuel down to zero and records the required amount, consumed amount and shortfall. Browsing, planning and cancelled previews consume none. Undo restores fuel along with the transaction or jump. Fuel type is recorded per purchase; grade mixing, refining, unrefined-fuel jump penalties and separate power-plant/small-craft consumption are resolved outside this tool.

Source: Core Rulebook Update 2022, p. 157 (jump consumption), p. 154 (prices); p. 180 distinguishes jump and power-plant tankage. Run `node --test verification/fuel.test.mjs` and `node verification/fuel-browser.test.mjs`.

**Refuel** opens its editable controls directly in the Overview right-hand screen. Current fuel, total capacity, −10/+10 tons, exact Top off and Fuel for next jump appear beside the live before/after payment quote. Top off uses the entire configured tank plus bladder capacity, limited by actual free cargo; it remains exact for odd capacities and includes any power-plant or small-craft allowance already entered in the tank setting. A full fixed tank can still fill configured bladders. A completely full ship shows a zero-quantity, zero-cost preview with all source and manual-reduction controls available; only an invalid purchase is disabled.

Refined, Unrefined, Water and Custom share one source dropdown. Custom is a local Cr/ton override with an explicit underlying refined/unrefined purchased grade, not a new physical fuel type. It retains ordinary supplier availability checks and records the price, grade and optional source note in the payment audit. Water remains free and selectable, with unavailable or unknown planet information shown only as an advisory. Decimal ton entries are accepted, with the existing whole-ton upward rounding shown before confirming; custom decimal prices use exact arithmetic and the configured final Credit rounding. Only **Confirm refuel** changes fuel and bank balances. There is no additional Adjust or Review screen for a normal refill. **Reduce fuel aboard…** remains a separate reviewed inventory correction with Audit, Undo and no payment/refund. The general Accounts Ship expenses workflow remains available.

When life-support stock already covers the normal target, **Refill life support** opens the reserve/comfort editor directly. The normal top-up stays zero; extra days and optional comfort spending remain available and retain their existing units, cargo, headcount and rounding rules. Opening or editing either service never changes the saved campaign. Back, Cancel, switching services and leaving Overview discard only the draft.

All six **Ship expenses** rows use consistent compact light-blue buttons. Mortgage and maintenance open their payment controls or the existing Settings setup route when unconfigured; crew salaries, life support, fuel and port costs retain their own editable service or payment routes. Recorded expense receipts and Undo are unchanged.

Run `node --test verification/inline-fuel.test.mjs verification/service-panels.test.mjs verification/expense-panels.test.mjs` and `node verification/inline-fuel-browser.test.mjs` for exact price/stock audits, full-stock controls, navigation, ownership and 320/390/1100/1440px checks.

## Optional reduced-profit price limits

In **Ship, trader & options**, **Enable reduced-profit price limits** starts off. **Minimum buy · % of base retail** defaults to 85; **Maximum sell · % of base retail** defaults to 115. Separate native number inputs offer one-percentage-point steps. Both accept whole percentages from 0 through 400 (covering the RAW table range and allowing stricter custom floors/ceilings); they are independent, so minimum buy need not be below maximum sell. Blank, fractional, nonfinite and out-of-range values are rejected.

The enabled option floors the generated purchase percentage and ceilings the generated sale percentage before converting to Credits, rounding, and calculating broker fees. The applicable base retail still comes from the independent commodity cap and illegal-goods RAW exception. Disabling this option restores the existing RAW quote formula; the existing 75%/Custom positive-profit adjustment remains separate and unchanged.

Custom values remain editable and persist through off/on toggles, reload, JSON export/import and Undo. Legacy schema-1 campaigns receive disabled defaults without changing historical prices. New quotes use the option; saved supplier offers keep their frozen terms, including when recalculated using their saved options. Explicit referee price overrides remain available and auditable. Audits retain both the RAW table percentage and the effective percentage before fees; the table's Price % shows the effective quote percentage.

Run the focused checks with `node --test verification/price-limits.test.mjs`, alongside the existing development checks above. Browser operation and native stepper appearance need browser verification.


## Wide map layers

The existing world views at **20–240%** are unchanged, including the close-view UWP labels; the additional 288% step extends that same presentation. Zooming below 20% adds a **subsector view** with real subsector names and faint world dots. Below 16%, the **sector view** prioritizes sector names, readable A–P subsector letters and a subtle subdivision grid. Sector and subsector names tilt 45° to use the diagonal space; A–P letters remain upright and avoid the name. Long names fit or wrap within their cell. The widest scale is 6%; the 20% boundary remains a reachable step on the + / − controls. Reset view still returns to the centered 100% world view.

Both wide layers use the same drag-to-pan camera. They are orientation views: zoom back in to select worlds or route stops. They do not change the ship, route, clock, bank, cargo or saved campaign. Sector coordinates and names come from Traveller Map's M1105 universe; named subsectors and world dots come from its metadata and sector tables. Unnamed subsectors show their official letter only. Failed requests remain retryable with Refresh nearby.

Overview data is separate from campaign and route-search data. The overview fetches only visible sectors, limits loading to two HTTP requests at a time, retains at most 48 sector records, and discards superseded loading queues. With Political territory off, the widest layer needs only the universe catalog. With the overlay on, it loads sector metadata without requesting world tables.

Run `node --test verification/map-overview.test.mjs verification/map-viewport.test.mjs` for layer boundaries, coordinates, camera continuity, M1105 parsing, and cache/race checks. Run `node verification/map-overview-browser.test.mjs` for the new layers, both preserved world views, retry, pan/cancel/reset, mobile and campaign invariants. Its compact fixture is sampled from live Traveller Map M1105 responses retrieved on 2026-10-08.


**Political territory** is one optional toggle at every zoom level. It starts on and remembers your on/off choice in this browser, separately from campaign JSON. Redraws, campaign imports and resets preserve that choice; reloads restore it when browser storage is available. If preference storage is unavailable, the toggle still works for the current session. Faint allegiance colors and restrained borders follow Traveller Map's M1105 border hex paths, including sector-edge continuations; they do not color whole subsectors or infer territory from world allegiance. Regions unrelated to political borders are excluded. Missing border metadata leaves the area unshaded, which does not imply unclaimed space. Names, dots and the subdivision grid stay above the overlay. The tint sits beneath world names, UWPs, hexes and routes at close zoom. Toggling it never changes the campaign, selected world, route or camera; the original close-up details and interactions are preserved.

Run `node --test verification/map-preferences.test.mjs` for preference defaults, persistence and storage-failure checks.

Run `node --test verification/map-territory.test.mjs` for actual hex-edge geometry, parity, exact sector footprint, cross-sector continuity, one-hex/retraced/unclosed borders, safe styles and live-data coverage. Border geometry adapts [Traveller Map's renderer](https://github.com/inexorabletash/travellermap/blob/main/server/RenderUtil.cs) under Apache-2.0; the notice and full license are included in `licenses/`.


## Mail check

In **Contracts → Freight & mail**, **Check for mail** checks independently without generating freight lots. Choose a destination and review the search roll/skills; freight traffic DM and the mail freight-band DM are calculated automatically. The card shows availability, the rolled container count, tons, delivery payment and whether the entire consignment fits in the remaining hold. **How was this calculated?** expands the search dice, endpoint population/port/TL/zone modifiers, distance, search Effect, mail-band, armed-ship, origin low-tech, highest Naval/Scout rank and highest SOC DMs. Existing Settings supply the armed/rank/SOC values; the card provides a shortcut to edit them.

Leave the separate **Mail availability · 2D total** and **Mail containers · 1D roll** fields blank for automatic rolls, or enter physical/manual dice. The container die is only used after a successful availability check. **Find contracts** still generates freight and mail together, with the same separate optional mail inputs; its existing sequence override remains supported. A separate mail total replaces that roll without consuming sequence dice.

Rules remain Core Rulebook Update 2022 pp. 240–241, INT-002/004: 2D plus DMs must reach 12; 1D containers each occupy 5 tons and pay Cr25,000 on explicit destination delivery. Mail is available to check independently of freight’s 1–6 parsec payment table. No guessed freight rate, mail deadline, automatic payment or late-mail penalty is added. Acceptance is all-or-none and reserves hold space; delivery releases it and can pay only once. Existing referee term overrides and Undo remain available.

Unaccepted offers stay in this session only. Reloading does not restore actionable offers from History. Accepted contracts persist normally, and historical checks remain read-only. A new standalone mail check replaces the session’s previous unaccepted mail offer while keeping its freight offers. Undoing a mail check discards that session’s mail offer; undoing a combined search or offer edit discards affected session offers rather than rebuilding older ones from History.

Run `node --test verification/mail.test.mjs verification/mail-ui.test.mjs` for rule boundaries, lifecycle and native UI/control checks. The latter uses a simulated DOM; it is not browser or visual verification.


### Mail browser CI

The **Mail browser checks** GitHub Actions workflow checks out the exact PR head and runs focused Mail tests in real Chromium. It uses a loopback-only static server, fresh synthetic campaigns and deterministic Traveller Map fixtures; it does not publish the app or access player campaign data. The workflow has only `contents: read`, disables saved checkout credentials, uses commit-pinned official GitHub actions and installs Playwright 1.58.2. Screenshots, per-case traces, a JSON summary, source-data/native logs and the tested commit are retained as an Actions artifact for 14 days.

To run the browser check locally with Playwright installed, start the static server described above, then run `node verification/mail-browser.test.mjs`. An optional argument supplies an installed Playwright module path, as in the other browser scripts. `TRAVELLER_TEST_URL` sets the server address; `TRAVELLER_COMMIT` labels the report. Browser results are separate from simulated-DOM tests and from the two existing native routing failures documented in RULES_VERIFICATION.md.


### Visible Mail rolls and Audit

Expanding the Mail panel shows the recorded availability dice/total, combined DM and final result against 12+ without opening the nested calculation details. The container roll is shown when recorded. **Audit** opens a read-only view of the saved search inputs, each endpoint’s population/port/TL/zone values and DMs, distance, search Effect, freight-band conversion, armed-ship, origin low-tech, rank and SOC modifiers, including zeroes and rule references. **How was this calculated?** stays available. New checks snapshot these inputs so later Settings or world edits do not rewrite the audit.

Mail contract rows retain the visible roll summary after acceptance, delivery and reload, using their saved audits; older missing rolls or inputs are labeled not recorded. No historical dice are recreated and no unaccepted offers are restored from History.

**Check for mail** sits beside **Manual contract** in the Freight & mail action row; both use the same light-blue style. The entire **Mail** panel starts collapsed to save space. Its clickable, keyboard-accessible header shows the latest status, tons and payment, including capacity or origin blockers for an available offer. Open it to reach the recorded rolls, Audit, Settings and acceptance controls. The header distinguishes unchecked, unavailable, accepted, delivered, cancelled and inactive results; new checks also announce their result above the page. Opening or closing the panel preserves the offer and dice, survives tab changes and new checks within this visit, and never changes campaign data. Reload starts collapsed and still does not restore an unaccepted offer.

Inside the expanded panel, accepted/delivered/cancelled shipment details retain their independent collapse control. The recorded roll, outcome, route and Audit stay visible when only those inner details are collapsed. A new check resets the inner shipment details to expanded without changing the outer panel choice.

### Cancel Mail before departure

Accepted Mail now offers **Cancel mail** in its shipment details and saved contract row. Confirm **Cancel mail and start over** to release that whole consignment's hold space without payment or penalty, then use **Check for mail** for a fresh result. Other contracts and freight offers stay unchanged. The cancelled contract, saved dice, terms and cancellation audit remain visible; **Undo latest change** restores the consignment and its capacity reservation together.

Cancellation is available only before that Mail's first committed jump. Even a zero-hour jump closes it; returning to the origin, replacing the route or correcting the date/location does not reopen it. Undoing that jump restores its prior eligibility. Delivered Mail cannot be cancelled. Read-only tabs cannot commit cancellations, and an outdated confirmation must be reopened.

New accepted Mail saves an explicit departure marker in the jump transaction, including through JSON export/import. Older contracts without that marker are cancellable only when their complete, consistent acceptance/Undo/jump trail proves they have not departed. Missing or ambiguous older history displays **Travel history unverified** and disables cancellation. Older imported campaigns may have revision discontinuities that prevent this proof; the app does not guess from the ship's current location or date. Existing schema-1 campaigns remain readable without silently assigning an unrecorded departure state.

Run `node --test verification/mail-reset.test.mjs verification/mail-ui.test.mjs` for state/import/Undo and actual-app lifecycle checks. `verification/mail-browser.test.mjs` extends the existing real Chromium gate with cancellation, history, ownership, return travel and JSON-import flows.

### One current Mail result and a quieter contract list

Cancelled Mail no longer appears in the main Freight & mail table. Its contract, rolls and cancellation are retained in **History → Cancelled mail archive → Audit/View**, including imported records without their original event trail. The normal cancellation history entries remain readable too. Undo restores the accepted row and cargo reservation. Accepted and delivered contracts, freight offers and the collapsible Mail panel are unchanged.

Each new Mail check replaces the previous displayed result. History identifies the older check as **Superseded mail check** and links it to its replacement, while preserving the original dice, terms and inputs. Only the current session's newest unaccepted Mail offer can be accepted. An unavailable result also replaces the prior offer. Already accepted consignments remain separate contracts.

Reload/import reconstructs a valid latest saved result for read-only viewing; it never recreates an actionable offer. Undo can restore the previous result reference, also read-only. Older backups without the new reference use only a consistent retained action/Undo trail; otherwise the panel remains unchecked. The Mail panel still starts collapsed after reload and preserves your open/closed choice during the session.

### Compact Bank & ledger rows

**Details** comes first, followed by the Entry label on the same row, with smaller row padding. Longer labels wrap and the wide ledger scrolls inside its panel on small screens. Amounts, transaction order, balances, audit actions and accounting rules are unchanged.

## Stage 1 Overview

Seven folder-style tabs share a compact ship/current-world/fuel/life-support/cargo/credits strip. Cargo occupancy expands to include freight/mail, luggage and bladder fuel. Ship service shortcuts and campaign-day controls are on Overview; Trade reuses the existing supplier and cargo-sale panels without repricing or regenerating offers.

The Route disclosure retains Plot route, Auto plot, Build route and Clear planned route. Active drafts keep Save, Remove, Retry and Cancel visible. Route chips wrap without separating their outgoing arrows. Previous/Next only browse. **Jump to [next destination]** is paired with the saved next destination above the wrapped route, with Current/Next chip badges. It follows actual route progress even when browsing another world, opens the existing **COMMIT JUMP** confirmation, and never commits the whole route. It is disabled during draft planning, without a next leg, or in read-only tabs. The old duplicate jump action below the map is removed. Current system returns to the actual ship; Reset view resets the viewed map, not the ship.

The four Overview shortcuts (Refuel, Refill life support, Cargo Hold and Ship expenses) switch the same right-hand screen directly. Switching services or leaving Overview for another tab discards unfinished service drafts, just like Back, and never applies a payment or reverses a recorded transaction. Trade and Accounts regain their ordinary controls immediately; editor ownership and actual-world restrictions still apply. Stale controls retain their original session token and cannot commit into a newer screen. Port costs is a compact row inside Expenses, using the existing saved weekly berthing rate and overrides. Roll and save starport rate remains an explicit, separate audited action. The Accounts Ship expenses button retains the existing combined-payment dialog.

The compact Overview cargo table uses frozen recorded purchase rolls/DMs/percentages and the remaining cost basis. Opening or older cargo without those values says Not recorded; Audit opens the original detailed audit.

## Trade navigation recovery

If the map is browsing another world, **Find supplier**, **Find buyer**, **Sell**, and **Get sale offers** explain where the ship is and offer **Continue at current system**. Continuing changes only the trading view and opens the requested form; searching still requires an explicit preview and commit. Cancel keeps the browsed world and campaign unchanged. Remote purchases remain prohibited.

The tabs now share the centered map/content gutter on wide displays. The Overview map is slightly shorter (400–600 CSS pixels with unchanged logical hex scale), and the world details, UWP, trade badges, route navigation and help beneath it use larger text.

Run `node --test verification/trade-actions.test.mjs` for the application regression and `node verification/trade-buttons.test.mjs` for desktop/mobile browser clicks, recovery, cancellation, local commits and related controls.


## Compact Settings page

The Settings tab contains all 44 existing controls in grouped, aligned rows. Direct
numeric typing and visible up/down buttons share the original bounds and rounding;
checkbox switches and dropdowns retain their existing values and choices. Every
section heading, including Rounding & time and Backup & data, expands or collapses
its section by click, Enter or Space. Common settings and the two utility panels
start open; trader modifiers, optional pricing rules, taxes/insurance and credit
rounding start collapsed. Open/closed choices survive Save, Revert and tab changes
for this visit without changing campaign data; reload restores the defaults.
Collapsing a section preserves unsaved values, and Save includes hidden fields. An
invalid hidden field is opened and focused for correction. Cross-field errors
reveal all field groups and focus the error message so the related values can be
reviewed together. Fuel and cabin rule details remain in independent disclosures.

Select **Save changes** to commit the full form as one undoable settings action, or
**Revert changes** to reload the saved values. Draft edits survive tab navigation in
the current page but are not saved until submitted. If another action or tab changes
the campaign while a draft is open, saving is blocked until the latest settings are
loaded with Revert changes. The existing settings dialog remains available as an
alternate editor and for missing fuel/life-support setup. Backup, report, time,
rounding preview and reset actions retain their existing confirmation flows.

Run `node verification/settings-browser.test.mjs` for the deterministic 44-field
inventory, desktop/mobile layout, controls, persistence, Undo, validation, read-only
ownership and cancellation checks.

## JSON-safe Undo and imported insurance histories

Saving blank fuel settings, then configuring or clearing/reconfiguring fuel in the
same session, now records Undo against the JSON form of the campaign. Optional
undefined properties are treated as absent, and every saved/restored campaign is
validated again after JSON serialization before its bytes replace the saved copy.
The running campaign receives that same validated serialized state.

Existing valid schema-1 saves keep their history and remain compatible. An already
invalid backup with a missing Undo value still opens Recovery and its raw bytes
are preserved for export; this update does not guess missing values or discard
history. Export the raw backup before choosing a valid restore or reset.

Imported policies may omit the optional amendment-history array. An approved
amendment or closure starts that history when necessary; malformed histories still
fail import validation, and Undo restores the original omitted field. Premiums,
claims, taxes and profit calculations are unchanged.

The native persistence and insurance lifecycle suites cover serialization, strict
imports, claims, reload and Undo. The real Chromium Settings and fuel suites cover
blank setup and same-session fuel edits; `verification/insurance-browser.test.mjs`
covers JSON-file imports and insurance amendment/closure/claim lifecycles.

## Trade complication flags (campaign house rule)

New purchase and sale price quotes inspect their three natural dice before any
DMs: exactly two matching dice flag **Complication**; three matching dice flag
**Severe complication** instead. The GM decides the issue and consequences.
The flag itself changes no price, elapsed time, cargo, insurance or other state.
It is not a Core Rulebook price-table rule.

Large, bold red **COMPLICATION** / **SEVERE COMPLICATION** warnings appear on
offer/negotiated sale rows, purchase/sale previews, and Audit.
Purchases from the same commodity offer keep its one original roll; separate
cargo lots each negotiate their own sale roll. Cancelling or editing a sale
retains that buyer's current quote until the campaign changes, as before.
Local-ban repricing retains the original natural dice and flag; a manual price
change also retains the flag. A referee-entered roll total has no natural faces,
so Audit says **Unknown · natural dice not recorded**, never a clean roll.

Versioned quote audits persist through purchase cargo records, sale ledger
entries, JSON backups, reload and Undo. Historical quotes without this audit
field say **Not recorded for this quote** and gain no retroactive flags.
No incident-management or automatic consequences are applied.

Run `node --test verification/trade-complications.test.mjs` and
`node verification/trade-complications-browser.test.mjs` for the focused checks.

## Selected-world screen and map key

Overview places the navigation map on the left and a dedicated world-data screen
on the right from 1100px wide; narrower screens stack the readout below the map.
The old world strip is moved into that screen, with every existing action retained.
It shows the selected world, sector/hex, subsector, allegiance, travel zone,
population, all eight decoded UWP fields, bases and gas giants. Calculator trade
codes use the same effective UWP as the map label. A saved UWP override updates
all eight decoded fields and the population exponent in this screen; the existing
published PBG multiplier is retained. The original published UWP and override
reason remain visible as reference. Other metadata and map symbols stay published.
Invalid effective UWP displays an explicit warning and published fallback; unknown
fields and missing population multipliers remain unknown.
Planet information still opens the full system/remarks view and its existing refresh.
Reading the screen makes no additional per-world API requests.

At 240–288% zoom, published starport letters, gas giants, Naval/Scout bases and
amber/red zone arcs appear at the actual hex coordinates. Only the documented
subset is drawn: other bases remain identified in the data screen. Long names
are ellipsized within the hex; their full name remains in the accessible label,
hover title and selected-world screen. The optional UWP label retains calculator
overrides. The cyan ship marker stays distinct from the dark translucent blue selected hex, bright inset outline and small white center brackets. The selected name/UWP stays white; the inset leaves political borders readable, while routes and symbols draw above the fill.
Clicking, keyboard browsing, panning or zooming never moves the ship.

Small World Data labels, values, UWP rows and map-key text use 14px type.
The selected-world name and the existing panel widths are unchanged; long values
remain fully readable. UWP words stay intact; the table scrolls inside the panel
on narrow screens instead of splitting labels or meanings mid-word. Jump-fuel
and life-support bars share aligned summary
tracks even when a value or the life-support stock note wraps.

The compact key below the data explains symbols and distinguishes political
borders from travel zones. Unknown data stays unknown, including missing bases,
gas-giant counts and unknown-world population. No Wiki or generated-world links
are added. Source definitions: [Traveller Map Second Survey](https://travellermap.com/doc/secondsurvey)
and its [renderer](https://github.com/inexorabletash/travellermap/blob/main/server/Stylesheet.cs).

Run `node --test verification/world-symbols.test.mjs` and
`node verification/world-screen-browser.test.mjs` for focused verification.
The browser suite checks 1440/390/320px layouts, closest-zoom symbols, long names,
keyboard browsing, unknown fields, effective overrides, and byte-identical saves
(including Undo) across read-only interactions.

## Mortgage and monthly maintenance

Settings has separate Mortgage and Monthly maintenance groups. Both use fixed, exact whole-Credit amounts on a four-week (28-day) schedule. Their amounts are not silently changed by the general Cr100 rounding option. Existing campaigns remain unconfigured until their actual figures are entered; configuring or correcting a schedule does not charge the bank.

For a mortgage, record the original mortgage amount, fixed installment, payments remaining, actual total paid so far, and first/next unpaid Imperial due date. A new mortgage normally has 480 installments with the original amount divided by 240 as its fixed payment; the form shows that calculation as guidance and retains the entered installment. With the campaign's 28-day interval, 480 is the nominal mortgage rule's payment count, not 40 elapsed 365-day years. Remaining scheduled payments are installment × remaining count. They are not principal, equity or an early-payoff figure; any payoff is resolved manually. Prior payment dates are not invented from the opening total paid.

Maintenance records its own entered cost and next unpaid due date. It has no annual-overhaul simulation, penalties or automatic charge. Its paid-since-tracking total counts only maintenance payments recorded by this feature.

Overview → Ship expenses displays aligned recurring costs and a regular four-week total. Variable fuel and port costs are listed separately and excluded from the total. Select a compact expense name to open its payment or service controls in the same right-hand screen. Mortgage and maintenance show the installment count, total cost, cash remaining and expandable covered-date list before the final Pay action; Cancel and Back discard only the draft. After Pay, the screen stays on a ledger-backed receipt with amount and campaign date, and only Back to Expenses. Reload restores that receipt; a fresh payment form offers View last payment. Accounts → Ship expenses also supports selecting Mortgage, Monthly maintenance, or both in a single explicitly confirmed batch. Each starts at its own next unpaid due date, covering arrears before future periods. Advancing time never debits either schedule, and already prepaid installments are not charged again. The mortgage cannot pay more installments than remain. Expanded coverage lists show each installment's due date and amount.

The whole expense batch commits atomically. Ledger Details retain the original figures, paid amounts and schedule before/after; receipts preserve the campaign date recorded at payment. History → Undo latest change restores the bank, both schedules and totals together. JSON backups/imports retain the records and reject inconsistent payment audits. The TXT report includes the original mortgage, total paid, remaining scheduled amount and maintenance totals.

Run `node --test verification/mortgage.test.mjs verification/maintenance.test.mjs verification/persistence.test.mjs verification/expense-panels.test.mjs`, the full native runner, and the `mortgage-browser` and `expense-panels-browser` scripts for synthetic real-browser payment, receipt and service-switch coverage.

## Cargo Hold bridge manifest

Overview → Cargo Hold opens a read-only quick manifest in the right-hand screen.
It shows used/free capacity, separate owned speculative lots, accepted freight
and mail, and the existing luggage, bladder-fuel and life-support cargo
reservations exactly once. Separate purchases remain separate rows. Purchase
Cr/t comes from each frozen purchase record; its percentage uses that record’s
historical effective base, including a saved manual price override. Missing
prices or bases say Not recorded. Neither present-day settings nor an insurance
destination reprices or assigns a destination to owned cargo.

The opaque Cargo investment footer stays directly below the internally scrolling
goods rows and above freight/mail. It sums remaining owned-lot cost basis,
including recorded costs, without adding promised contract income. Long rows
scroll horizontally within keyboard-focusable regions. Open Cargo and Open
Contracts retain the full existing workflows. The existing lower Overview cargo
table remains available with its original roll/DM columns and controls.

Opening Cargo Hold or another service discards only an unfinished service draft;
it never records or reverses a transaction. The manifest is available in read-only
tabs. Viewing, scrolling, details, map selection, and closing do not change
campaign/save/Undo data. Reload starts with World data unless a saved expense
receipt was already the current receipt view.

Run `node --test verification/cargo-hold.test.mjs verification/world-symbols.test.mjs`
and `node verification/cargo-hold-browser.test.mjs` for exact accounting, frozen
purchase facts, blue-hex layering, cancellation, scroll/footer, read-only and
320/390/1100/1440px responsive checks.


## Passenger contracts (UI 2026.10.09.27)

Freight/Mail now includes **Passengers**. Review passenger capacity before the first boarding: reserve the cabins used by crew and other existing occupants, and enter installed Low berths separately from low-service cabins. Existing combined headcounts are preserved as the non-booked baseline. Booked people are added automatically to life support; do not enter them again in Settings.

**Find passengers** searches for High, Middle, Basic and Low passage to a destination within one jump. Availability, fares and modifiers use Core Rulebook Update 2022, pp. 158, 238–239. The audit retains search inputs, traffic/count dice, endpoint modifiers and the original availability. Select any whole number within the remaining pool. Unaccepted offers are session-only; saved History does not recreate actionable offers after reload/import.

High and Middle default to private cabins. Explicit two-per-cabin sharing preserves the campaign's referee-managed allocation, including High double occupancy. Two High people sharing one standard-cost High cabin still cost Cr7,000/month (Cr1,000 cabin + 2 × Cr3,000 people). Basic defaults to shared cabins; fitted spare space can instead reserve 2 t/person when confirmed. Shared bookings of the same class pool their places, rounding the total up to cabins. Low passage needs an installed physical Low berth, never an awake low-service cabin. Steward cover is confirmed on boarding; Low revival is resolved in play.

High baggage defaults to 1 t/person, Middle to the established campaign override of zero, and Basic/Low to 0.01 t/person. Automatic baggage is combined before the existing whole-ton rounding. A manual whole-ship luggage override, including zero, remains fixed through boarding/delivery until edited. Legacy explicit luggage totals without the newer mode flag remain manual when Settings is saved; current-format automatic baggage remains automatic.

Boarding preserves bank and physical LSS stock. Future consumption includes each booked awake person once, and each Low passenger at 0.1 LSS/day. Standard monthly billing adds Cr3,000 per booked High person, Cr1,000 per Middle/Basic and Cr100 per booked Low; installed cabin charges and old baseline frozen billing are unchanged. New bookings do not add installed cabins or charge their cost again. Extra-supply pricing keeps the existing campaign rule.

At the actual destination, **Complete passage** releases the booking and posts its payment once. Payment on explicit delivery is an app convention, not a Core timing rule. No automatic freight lateness penalty, speculative-trade tax/profit adjustment, passenger mortality or lottery charge applies. Accepted terms, receipts, JSON backups, reports and History Undo retain the original calculations. Undo reverses occupancy and payments together; used life support is restored only when undoing the action that consumed it.

Native checks: `node --test verification/passenger-rules.test.mjs verification/passengers.test.mjs verification/passenger-ui.test.mjs`. The independent `passengers-browser.test.mjs` script covers the real UI and must pass on the exact release candidate alongside the existing browser matrix.

## Fuel bladder capacity in tons

Settings and setup now ask for **Fuel bladder capacity** directly in whole tons.
For example, entering `2` installs 2 t of capacity, without adding fuel. Hull size
and drive rating still determine fuel burn: a 200 t Jump-2 ship needs 40 t for a
full-range jump. Changing those settings never resizes a direct-ton bladder.
The compact Overview readout identifies actual total **Aboard**, base **Tank**
capacity, and **Bladder** capacity separately; the bar uses total fuel capacity.

Legacy jump-count saves are read without rewriting saved bytes or Undo history.
Their old capacity is preserved using extra jumps × ceiling(hull tons × jump
rating / 10), so an old value of two on that 200 t Jump-2 ship remains 80 t, not
2 t. Saving Settings converts it to direct tons. Undo can restore the original
legacy record and earlier retained changes. Missing or contradictory legacy
figures are rejected rather than guessed.

New or edited bladder capacities cannot exceed the total cargo hold or take
combined base/bladder capacity above ship displacement. Existing oversized
installed capacity remains usable during unrelated Settings edits; increasing
that capacity or reducing the hold requires a fitting value. Fuel actually in
bladders must always fit alongside cargo, contracts, luggage, and life support.
Shrinking or removing a bladder below fuel already aboard requires an explicit
stock correction. Empty bladder capacity consumes no cargo space, and normal
refuelling and fuel consumption continue to fill base tanks first and release
bladder cargo space first.

Run `node --test verification/bladder-capacity.test.mjs` and
`node verification/bladder-capacity-browser.test.mjs` for focused migration,
Settings, cargo limits, save/import/Undo, compact readout, and responsive checks.

## Contextual rule references (UI 2026.10.10.33)

Small circled **i** buttons beside calculation groups open a short reference
popup. They work with click, touch, Enter and Space; Escape or the close control
returns to the source button without closing the underlying transaction. The
same reference catalogue is available from **Rules & Notes**. Long explanations
scroll within the popup, including on narrow screens.

References identify the book and printed pages, then distinguish published
mechanics, Home rules, App conventions and Referee inputs. They do not supply
missing historical rolls or recalculate saved transactions. Existing warnings,
amounts, audits and commit controls remain in place. In particular:

- The shared per-planet search clock is a campaign interpretation: 28 days from
  the first committed search, with all penalties clearing together. Core says
  “same month”; it does not prescribe this grouped clock.
- Bladder capacity is entered directly in tons. The combined fuel-store model
  is separate from the hardware context in Core pp.184–185.
- Optional insurance cites Merchant Prince First Edition (2010), pp.82–83;
  tax cites pp.86–87, with the table on p.87. The bracket-gap correction remains
  INT-009, not a claimed publisher erratum.
- Physical LSS consumption/storage cites Cluster Truck p.14. Refill pricing
  remains the separately labelled campaign policy.

No rulebook files, scans, private links or copied source passages are included.
The catalogue is display-only; campaign schema, calculations, saved audit
records, Undo and browser storage are unchanged.

## World Changes in History

History has a **World Changes** filter, available in both editing and read-only
tabs. New world edits retain the target world, reason and each changed UWP
component, travel zone, fuel override and accessible-water value. The audit and
its committing summary appear as one readable row; all saved evidence remains
in JSON and History.

An editing tab can open Details and **Restore previous** for an individual
field. For example, restoring a recorded Tech level change preserves later
changes to the other seven UWP components. Each restoration is a new audited
correction. It changes no completed jump, payment, cargo, contract or saved
market quote. A later edit to the same field, a mismatched current value or a
stale preview prevents the restoration. Ordinary Undo can reverse the new
correction.

“Previous” is the value before that particular edit; it may itself be another
campaign override, not the published default. Older generic World override
entries lack reliable target/before/after information and offer no guessed
restoration. Select the intended world and use the existing World override
editor to enter the desired values; its published-UWP reference remains visible.
No bulk reset, audit deletion or new permission system is added.

The one-mulligan jump restriction is unchanged. Attempting History Undo at a
protected jump now shows a warning and writes nothing. It cannot erase or skip
that jump. Individual eligible world-field corrections remain available without
rolling back travel or transactions. Run the native
`verification/world-change-history.test.mjs` and the independent
`verification/world-change-history-browser.test.mjs` for focused verification.

## Financial Dashboard

**Dashboard** is a separate, read-only tab with cash balance, recorded operating result by jump/visit, cash expenses by category, and cash income by category. Charts use local SVG; exact Credits and accessible tables remain available without a chart dependency. New campaigns start at their opening date and balance. An existing campaign starts once at its current date/balance when the editing tab opens the upgraded app. Earlier activity is excluded; its old history is not reconstructed. The saved boundary travels with JSON backups/imports and never resets when the Dashboard is reopened.

Each committed jump starts a destination visit; later transactions belong to that visit until the next jump. The starting visit precedes the first tracked jump and the last visit is ongoing. Transactions follow saved ledger order, including same-hour entries and clock corrections. Cash graphs group very long series while retaining every exact row; the operating chart shows the latest 24 visits with every visit in its table.

Operating result reuses the TXT report: saved realized sale profit plus freight, mail and passenger receipts, less recorded ship/manual operating expenses. Unsold cargo, capital deposits, bank/rounding corrections, insurance claims and cargo writeoffs are excluded. Sale profit already incorporates cost basis, fees, taxes and retained-profit adjustments; those charges are not deducted again. Category charts are cash-flow breakdowns, so cargo purchases/proceeds appear there even though they are not the same as profit. Opening funds, deposits and bank/rounding corrections appear separately from category totals. Missing sale audits make the affected operating result unavailable.

Undo uses the surviving ledger. Reversing activity from before the fixed starting point produces an explicit **Earlier-history adjustment**, reconciling cash without changing the original baseline or calling the adjustment profit. Baseline initialization does not advance the campaign revision, add an Undo action or consume a jump mulligan. Read-only tabs never initialize it. Failed storage writes leave the original campaign intact and editing unavailable until a successful retry. Browser-local storage limits still apply; keep JSON backups.

Verification: `node --test verification/dashboard-data.test.mjs verification/dashboard-view.test.mjs verification/persistence.test.mjs` covers pure derivation, exact amounts, escaped/accessible markup, baseline ownership and persistence. `verification/dashboard-browser.test.mjs` covers real Chromium at 1440/390/320 pixels, actual setup/import, charts/tables, first-writer initialization, reload/Undo, takeover and failed storage. It is included in the read-only exact-head PR browser matrix.

## Save-completion work

[Completion migration queue](COMPLETION_MIGRATION.md) distinguishes the remaining
Stage 2 save callers from the later Stage 3 quote/preview ownership work.
The .42 batch covers jump preparation and committed travel only. Normal local
saves remain immediate. A delayed provider keeps the exact jump review pending;
safe failures permit correction/retry, while a saved or uncertain outcome asks
for a reload before continuing. Saved dice, travel economics and the existing
one-mulligan policy are unchanged.

`verification/jump-completion.test.mjs` and the exact-head
`jump-completion-browser` CI job cover delayed success/failure, duplicate
activation, stale ownership/revision, display failure and reload alongside the
existing synchronous jump and campaign regression suites.

Undo save completion (.43) retains ordinary History Undo's immediate
behavior and Undo Jump's existing confirmation. A delayed save waits before
clearing previews or claiming success. Known-unsaved Undo can be retried from
History after closing its notice; an uncertain or already-saved outcome requires
reload before further editing. See [the completion migration queue](COMPLETION_MIGRATION.md)
for remaining callers and the explicit .43 live-file verification gap.


Campaign replacement completion (.44 candidate) keeps the existing backup
confirmation for import/reset. Saving waits for the provider's durable write
and publication before changing the viewed world, clearing selection or showing
success. The published campaign supplies the rebased revision and Dashboard
starting point. A known-unsaved failure keeps the review for correction/retry;
an uncertain or already-saved outcome requires reload and verification of the
saved campaign before another replacement. A late file read cannot overwrite a
newer selection, dialog, campaign or editing tenure. JSON schema, economic
values, History/Undo and jump-mulligan rules are unchanged.
