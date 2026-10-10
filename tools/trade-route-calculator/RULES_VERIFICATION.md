# Traveller Ship Operations — Rules Verification

**Overall status: source/data gate complete; initial application 0.1.0 automated checks passed. Campaign playtesting remains open.**

This is the public status and evidence record for the calculator. It tracks the verification required by [REQUIREMENTS.md](REQUIREMENTS.md#rules-verification-before-implementation) and [ARCHITECTURE.md](ARCHITECTURE.md#rules-verification-gate). A planning decision or a checked box without supporting evidence is not rules verification.

## Baseline and deliverables

- Intended rulebook: Traveller Core Rulebook Update 2022.
- Examined source: Core Rulebook Update 2022, copyright 2024; August 2024 publisher FAQ reviewed. See [source baseline](RULES_REVIEW.md#source-baseline).
- Verified source/data version: 0.1.0; [data, source coverage and checks](rules/README.md).
- Source references: [RULES_REVIEW.md](RULES_REVIEW.md) and [dataset provenance](rules/README.md).
- Independently calculated expectations: [worked results](RULES_REVIEW.md#worked-expected-results), compared in the source/data and application suites.
- Source/data baseline commit: [fc29eeaf10a90c929dfde974246ab693d9034b58](https://github.com/OwlsNestNH/Traveller-Tools/commit/fc29eeaf10a90c929dfde974246ab693d9034b58).
- App implementation: [README.md](README.md); reproducible checks and evidence below.

Keep the rules data, concise source references, examples, and results in GitHub. Do not upload PDFs, add private source links, or make the app depend on the user's files/accounts or design chat. The existing `tools/spec-trade/` implementation is buggy/untrusted and cannot establish correctness.

## Core Rulebook verification checklist

Source findings and resolved interpretations are recorded in [RULES_REVIEW.md](RULES_REVIEW.md). In progress means evidence gathering has begun; it does not mean the complete area has passed.

| ID | Area | Status | Evidence needed |
| --- | --- | --- | --- |
| RV-01 | Edition and errata | Verified (source/data) | Exact source identity and applicable errata recorded |
| RV-02 | UWP parsing and trade-code derivation | Verified (source/data) | Rule references, boundary values, and expected codes |
| RV-03 | Commodity availability and tonnage | Verified (source/data) | Verified data, availability conditions, rolls, and quantity examples |
| RV-04 | Purchase and sale pricing | Verified (source/data) | Base prices, percentage tables, lookup boundaries, worked examples |
| RV-05 | DMs and combination rules | Verified (source/data) | Each modifier's source, signs, selection/stacking behavior, combined examples |
| RV-06 | Local brokers and fees | Verified (source/data) | Eligibility, skills/DMs, fee bases, and purchase/sale examples |
| RV-07 | Illegal goods | Verified (source/data) | Applicable availability, pricing, and legality rules with examples |
| RV-08 | Freight | Verified (source/data) | Availability, DMs, rolls, tonnage, payment and delivery rules |
| RV-09 | Mail | Verified (source/data) | Eligibility, availability, payment and delivery rules |
| RV-10 | Travel and dates | Verified (source/data) | Jump capability, fuel-availability inputs, elapsed-time rules and examples |

## App and house-rule checks

These policies come from the agreed project requirements. They must be checked against that specification, not labeled as Core Rulebook rules.

| ID | Policy | Status | Required example or check |
| --- | --- | --- | --- |
| PV-01 | Per-lot profit modes | Initial coverage passed; see limits below | RAW Cr101 profit becomes Cr75 in Reduced; losses/zero unchanged; RAW/Custom modes |
| PV-02 | Separate profitable and losing lots | Initial coverage passed; see limits below | Cr100 profit plus Cr100 loss becomes a combined Cr25 loss in Reduced |
| PV-03 | Bank, fees and cost basis | Initial coverage passed; see limits below | Acquisition debited once; partial-sale basis and fee remainders reconcile |
| PV-04 | Rounding and fractional cargo | Initial coverage passed; see limits below | Whole-Credit round-down without discarding decimal tons |
| PV-05 | Freight/mail exclusion | Initial coverage passed; see limits below | Contract payments unaffected by speculative profit settings |
| PV-06 | Fewest-jumps routing | Initial coverage passed; see limits below | Mandatory stop order, jump/fuel checks, tie-breaking and failed connections |
| PV-07 | Browsing versus COMMIT JUMP | Initial coverage passed; see limits below | Browsing changes no actual location/date or delivery state |
| PV-08 | Per-offer expiration | Initial coverage passed; see limits below | One expired offer leaves others active; reactivation/bulk action and undo |
| PV-09 | Historical evidence and recovery | Initial coverage passed; see limits below | Snapshot inputs and rules version survive reload/import; undo reconciles state |
| PV-10 | Mid-campaign setup | Initial coverage passed; see limits below | Opening cargo does not debit the opening bank; separate lots/bases remain intact |
| PV-11 | Referee corrections | Initial coverage passed; see limits below | Reasons and before/after values preserved; basis changes and undo reconcile |
| PV-12 | Backup/import/reset | Initial coverage passed; see limits below | Backup offered before replacement; confirmation/cancel and failure handling preserve data |
| PV-13 | Concurrent tabs | Initial coverage passed; see limits below | One writer; stale previews rejected; transfer reloads latest revision without lost updates |

Source/data assertions and implementation tests are separate suites; the results below identify each.

## Evidence record for a completed check

For each ID, add a section with:

- Status: Pending, In progress, Verified, or Needs correction.
- Source: exact edition and page/table, or a link to the applicable project requirement for app/house rules.
- Checked rules-data version and GitHub file/commit links.
- Inputs, calculation steps, independently derived expected result, and comparison outcome.
- Verification date, reviewer, and any unresolved discrepancy.
- Implementation test link/result when available, clearly distinguished from manual data verification.

Mark an area Verified only when its source, data, and worked examples have actually been compared and discrepancies resolved. Return affected checks to Needs correction when relevant data or interpretations change, retaining prior evidence for older versions.

## Completion criteria

The pre-implementation rules gate is complete when RV-01 through RV-10 have verified evidence, the versioned dataset and source references are checked in, and the required worked examples (including applicable accounting/house-rule examples) have been independently checked. UI, persistence, and other implementation checks remain pending until implemented and tested.

Record the verified dataset version and immutable commit here when that gate is met. The source/data gate for 0.1.0 is complete; initial application testing is recorded below. Source review and worked expectations must not be presented as a tested app.

## Optional first-edition verification

Insurance and taxation were added as independently optional V1 features on 2026-10-03. [OPTIONAL_RULES.md](OPTIONAL_RULES.md) records the source supplied by the owner, approved interpretations and remaining questions. Approval of an interpretation does not verify a source table.

| ID | Area | Status | Required evidence |
| --- | --- | --- | --- |
| OV-01 | Merchant Prince source | Verified (source/data) | First-edition Book 7 identity and printed references supplied by owner: insurance p. 83; taxes p. 86. INT-022 fixes the supplied tables as the baseline; later errata require a new reviewed version |
| OV-02 | Insurance | Verified (source/data) | Complete rates; approved distance/risk/value rules; premium and claims examples; partial-loss handling |
| OV-03 | Taxation | Verified (source/data) | Complete rates; INT-007/009; benchmark mapping, aggregation, allocation and boundary examples |
| OV-04 | Tax and profit modes | Verified (source/data) | INT-008; independently verify the Cr80000 example and loss/zero/off cases against the data and implementation |
| OV-05 | Persistence and transactions | Initial coverage passed; see limits below | Default-off switches, frozen audits, policy/claim/tax exports, duplicate prevention and atomic undo |

Optional calculations must not be implemented before the relevant source/data and interpretation checks pass; lifecycle and persistence checks require later implementation. The source/data gate and optional-module source checks are complete for 0.1.0; initial lifecycle and application results are recorded below.

## Completed source/data review — 2026-10-03

Reviewer: Codex. Version: **0.1.0**. Evidence: [data/source record](rules/README.md), [core data](rules/core-2022.json), [optional data](rules/merchant-prince-1e.json), [reproducible check script](verification/check_rules.py). Latest run: **198 assertions passed**.

The source comparisons and independent expected-value checks cover:

- RV-01: exact examined Core source and the previously reviewed August 2024 FAQ.
- RV-02: Core code-table field conditions, Map transport field order/eHex, boundary cases and unknown/malformed UWP behavior.
- RV-03: all D66 commodity rows, availability fields, population quantity DMs and zero quantities; INT-003 resolves black-market stock.
- RV-04/05: all price percentages/endpoints, source modifier signs, greatest-absolute-magnitude per-column selection (INT-024) and negative-only matches.
- RV-06: local broker skill rounding, +2 modifier, gross-value fees and partial-lot acquisition basis.
- RV-07: illegal commodity rows and higher-of-local/universal sale modifier; local item ban thresholds remain explicit referee inputs, not inferred solely from commodity names.
- RV-08/09: source freight/mail tables and values, combined endpoint/search/type DMs, mail eligibility, cargo size, delivery payment and late freight.
- RV-10: source jump-hour bounds and fuel facilities, with explicit accessible-water inputs rather than assuming every fluid ocean is usable fuel.
- OV-01/02/03/04: the supplied Merchant Prince tables, fixed baseline INT-022, insurance examples and agreed corrections, taxable-versus-actual profit, tax allocation and Reduced-profit ordering.
- Required accounting expectations: RAW/Reduced/Custom, loss/zero, separate winning/losing lots, decimal quantities, proportional cost/fee allocation, remainder reconciliation, insurance premiums and claims, and freight/mail exclusions.

INT-010 through INT-022 are approved on 2026-10-03. Merchant Prince's exact printing is not inferred; the owner explicitly selected the supplied tables as the fixed source baseline. This closes that source ambiguity without asserting that unidentified errata were checked.

Passing reference-data checks does not by itself test browser behavior. The following separate implementation checks have now run; continue to raise newly discovered ambiguities.


## Initial application verification — 2026-10-03

Reviewer: Codex. Application/rules version: **0.1.0**. These results establish initial automated coverage, not exhaustive verification of every possible campaign or browser.

- **198 source/data assertions passed:** [check_rules.py](verification/check_rules.py), as described above.
- **28 Node tests passed:** [app.test.mjs](verification/app.test.mjs). Exact decimals, allocation, UWP parsing/codes, negative DMs, brokers, price bounds, market generation, per-lot profit, partial cost basis, tax benchmark/order/brackets/allocation/exemption, insurance premiums/partial claims/coverage, transaction validation, freight/mail, delivery, corrections, undo, import validation and deterministic routes.
- **Browser integration passed in installed Microsoft Edge:** [browser.test.mjs](verification/browser.test.mjs). Supplier search, individual offer expiration/reactivation, fractional purchase, sale/undo, view-world browsing, route/jump, insured purchase/partial claim, late freight delivery, two-tab editing transfer, stale-preview rejection, 15 cargo lots, narrow-screen layout, export/import/reset cancellation, invalid imports, storage-quota failure, corrupt-save recovery and Rules & Notes. Traveller Map responses in this suite are deterministic fixtures.
- **Separate live browser API test passed:** [live-map.test.mjs](verification/live-map.test.mjs). Real Traveller Map CORS response included Regina, Ruie, Hefry and Jenghe; campaign setup and nearby-world map rendered using live data.

### Coverage and remaining limits

PV-01–05 are covered by exact-money, accounting and contract unit tests; PV-06 by route tests; PV-07–09 by browser and state tests; PV-10–11 by opening-cargo/correction/undo tests; PV-12–13 by browser recovery and concurrency tests. OV-05 has purchase/claim/sale/undo and campaign round-trip coverage. Test names, fixed inputs and expected assertions are in the linked scripts.

These are initial checks, not a claim that every listed acceptance case has its own automated assertion. Bulk-expiration combinations, all policy-amendment sequences, every possible manual override, long-running storage growth and alternate browsers need further playtesting. Browser layout coverage includes 15 cargo lots and generated market rows, not every possible list length or assistive technology.

Route search is bounded to loaded areas; calendar display uses the chosen starting label plus elapsed time. Referee inputs remain required for exotics, item-specific local bans, unsupported tax governments, premiums beyond six parsecs and policy amendments. No new rule interpretation is implied by an incomplete test case.

## Navigation UI checks — 2026-10-03

The searchable world selectors, Recent Worlds and numbered hex overlay change navigation presentation, not trade rules. [world-picker.test.mjs](verification/world-picker.test.mjs) passed in Microsoft Edge with deterministic API fixtures: derived hex, parent-selection clearing, stale-response protection, retry, empty sectors, unchanged campaign state while browsing, actual route origin, stop reorder/removal, route persistence, recent-world persistence/deduplication/ten-entry cap, grid alignment/toggle/world clicking, and narrow-screen width.

The existing browser integration suite and all 28 application unit tests also passed. The live-map suite now verifies real sector/subsector/world list loading and a Jenghe selection with its automatic hex, while the actual ship stays at Regina. This does not change the existing rules-source verification scope.

## Zoom, starting-world and era/calendar checks — 2026-10-03

The world-picker browser suite also covers wheel/button zoom without page scrolling or campaign mutation, a maximum 61-cell neighborhood grid, cancellation/confirmation/undo of the explicit starting-world change, preserved bank/cargo/time/contracts, and deduplication of a sector returned for four eras. All map requests now pin M1105; inspection of the live API confirmed Trojan Reach was previously returned for M1105/M1120/M1201/M1248.

The two [calendar tests](verification/calendar.test.mjs) passed, covering hour/day/year rollover, multiple years, invalid inputs and compatibility with custom saved labels. Calendar display is separate from fixed map-era selection; it uses the existing elapsed-hours accounting. The 365-day Imperial date convention is described in the linked [calendar reference](https://mail.freelancetraveller.com/features/culture/reference/calend.html); no additional trade rules or monthly-search conventions were changed.

Automatic-neighborhood regression checks passed: changing to a distant world loads and displays a previously unknown neighbor; a simulated failed lookup preserves the old campaign until retry; reopening a save loads missing nearby data. Requests use radius 12, and zooming out to 20% displays all 469 hexes in that radius without overlapping hex-number labels. These assertions are included in the world-picker browser suite.

## Trade table UI verification — 2026-10-04

Implemented the purchase-offer, cargo-sale and freight table requirements without changing rules data or pricing formulas. Validation: 30 Node application/calendar tests and 198 source/data checks passed. The Edge browser suite passed purchase/sale/undo, contract delivery, persistence and mobile layout checks, plus assertions for exact table headings, header/cell geometry, numeric alignment, expired-offer Buy disabling and audit access, cargo description edits, sale quote display/audit stability, independent lot cost bases, and freight offer edit/audit/accept/undo. Browser map responses use deterministic fixtures; this change does not reverify the live Traveller Map service.


## Ship expense verification — 2026-10-04

Checked the supplied Core Rulebook Update 2022: running costs p. 154; starport rates p. 257; weekly billing, one roll per starport, and fuel prices p. 258. Life support and salary amounts are entered by the user; monthly periods are manually selected, not automatically accrued.

All 35 application/calendar/expense tests passed. Expense cases cover every starport class, saved-rate reuse, effective class changes, decimal fuel quantities, nonstandard supplier confirmation, monthly multiplication, insufficient funds, zero-cost berthing, persistence and atomic undo. The Edge browser integration suite passed, including expense access, saved rolls, live fuel totals, cancel, monthly defaults, payment, readable ledger audits and undo. Existing trading, insurance, contract, recovery and mobile-layout checks remain passing.


## Map pan and expanded browsing checks — 2026-10-04

All 37 application/calendar/expense/viewport unit tests passed. The viewport tests cover visible-hex coverage across coordinate parity and zoom, two-request concurrency, superseded queues, failed-request retry and the 32-area cache bound. The Edge world-picker suite covers drag starting on a world without accidental selection, shared-layer movement, reset, click after cancellation, pan persistence during redraw, and fetching a previously unknown world 32 parsecs from the starting world. Browsing leaves the saved campaign unchanged and does not copy exploration areas into it. At 20% zoom ordinary world labels and hexes are hidden. Existing navigation and application browser suites passed using deterministic map API fixtures. No trade or route-finding rules changed.

### Fuel source clarification — 2026-10-04

User ruling: wherever refined fuel is available, unrefined is also available. Usable natural water supplies free unrefined fuel regardless of starport class, including E/X; otherwise establish a source through roleplay. Purchased fuel retains Core prices (Cr500 refined / Cr100 unrefined per ton). Core pp. 156–157 support natural collection; the A/B availability interpretation and free-water handling are explicitly identified as campaign rulings in audits. Hydrographics with exotic atmospheres require confirmation rather than assuming fluid is water.

Validation: 45 application, expense, accommodation and rounding tests passed. Fuel cases cover A/B unrefined purchases, free collection at A–X, dry/exotic/unknown worlds, referee confirmation, effective UWP overrides, zero-cost persistence and undo. The isolated Edge browser suite passed, including selecting free collection, previewing and confirming Cr0, unchanged bank and undo.

### TXT user report — 2026-10-04

Added a read-only user summary alongside JSON campaign saving/restoration. Cargo reports separate original purchase prices/discounts and charges from remaining quantity and cost basis. Completed sales retain their actual historical results; newly recorded sales also preserve commodity and profit mode. Missing old fields are labeled rather than inferred. Banking, realized trading profit and operating expenses are distinguished; free fuel records remain Cr0.

Validation: 48 application, expense, accommodation, rounding and report tests passed. Report tests cover partial sales, historical 75% versus current 100% mode, missing old metadata, very large integer Credits, markup versus discount, empty campaigns and no export mutation. The isolated Edge browser suite passed TXT download/content and unchanged campaign checks, JSON save/load and existing trading/insurance/expenses workflows.

### Readable ledger details — 2026-10-04

Accounts Details now renders labeled facts and explanatory text for purchases, sales, broker fees, taxes, profit adjustments, insurance payments/premiums/amendments, delivery income, opening funds, manual expenses and bank corrections. Trade calculations reuse the readable price-roll/DM tables and rule footnotes. No ledger type falls back to raw JSON. New purchase ledger entries retain immutable purchase price, quantity and audit facts after the cargo is sold; older missing facts are identified explicitly.

Validation: all 48 application/expense/accommodation/rounding/report tests passed. The Edge browser suite exercised every recorded ledger entry after a profitable sale with fees/tax and after insurance/claim transactions, checking that there is no code block, no missing-value rendering and no campaign mutation. Purchase details remain readable after the lot is fully sold. Sale details were also visually inspected.

### Readable contract and History audits — 2026-10-04

Removed the last generic JSON detail renderer. Contract offers, accepted/delivered contracts, and History entries now display labeled summaries and relevant saved calculations. Freight/mail rolls and modifiers, edits, jump duration overrides, searches, cargo corrections and rounding records remain accessible. Newly recorded contract searches also preserve the skill and characteristic separately; older records are not guessed or rewritten. JSON campaign backup remains unchanged.

Validation: syntax check and full isolated Edge browser suite passed, including every available History detail in the test campaign, edited freight offer calculations, mail search details, delivered-contract payment, no raw pre/code blocks, no invalid-value text, unchanged campaign data and continued JSON/TXT exports. Freight offer and jump History dialogs were visually inspected.

### Accommodation rate correction — 2026-10-04

User clarification: Cr100/Cr1,000/Cr3,000 monthly rates apply to low/middle/high staterooms, including empty rooms. Every passenger and crew member adds Cr1,000/month. A middle stateroom can upgrade to Cr3,000 service; custom rates replace the room rate. These are campaign-agreed settings, not a new claim of published-rule verification. Weekly billing remains one quarter of monthly cost. Legacy unclassified stateroom totals default to middle for review; historical payments remain immutable.


## Combined cabins and service costs — 2026-10-04

Supersedes the earlier campaign cabin-rate agreement for future expenses: installed middle and high cabins both cost Cr1,000/month, including empty cabins. Middle-service people cost Cr1,000/month; high-service people cost Cr3,000/month, including people in middle cabins upgraded to high service. Crew and passengers share cabin totals and headcounts. High-service people are a subset of the total, not additional people. Historical ledger entries are retained. Existing custom cabin rates remain explicit overrides. Low-service costs remain the earlier campaign convention.

Verified against the user's Core Rulebook Update 2022 (copyright 2024), pp. 154, 158 and 238, and High Guard Update 2022, p. 51: RAW high passage reserves 1 cargo ton per passenger; middle passage allows 100 kg. The user's campaign instead reserves luggage only for high-service people at an editable allowance, default 1 ton each; middle service adds none. The combined reservation reduces usable cargo space and follows existing whole-ton rounding. Cabin construction tonnage is outside this tool's scope. Older explicit luggage reservations remain until settings are reviewed and saved.

RAW High Guard lists Cr3,000 life support for a high stateroom. The new Cr1,000 cabin / Cr3,000 high-service person split is the user's campaign rule, not RAW. Applying installed-room costs while empty is the interpretation of Core's per-stateroom charge together with High Guard's replacement rate. RAW low berths use Cr100 per occupied berth and their occupants are excluded from the additional ordinary person charge; the retained Low cabin option is explicitly a campaign setting. Source PDFs are not included or required by the website.

Validation: combined-cabins browser checks and accommodation/expense/report unit tests cover combined totals, empty high cabins, person upgrades, saved luggage, and unchanged historical payments.


## Life support inventory — 2026-10-04

User approved tracking capacity and remaining days, with a visible Refill life support button buying only missing supplies. Default capacity is 28 days; both capacity and actual remaining stock are editable to whole-hour precision. Old campaigns show stock as unrecorded until configured. Setup does not invent paid supplies. Positive campaign-time advances consume stock and stop at zero; moving time backward does not create supplies. Undo restores the actual prior stock and bank balance. Supply exhaustion is displayed, with survival effects left to the referee.

Refill charges current cabin and person monthly costs multiplied by missing hours / 672, then applies the campaign Credit rounding setting once. Full stock cannot be charged twice; unaffordable refills do not partially apply. The user confirms supplies are available at the current world. Changing complement requires review of remaining days; this simple days model does not simulate individual food/air stocks. Historical expenses remain payment records; manual Ship Expenses charges do not refill inventory, so the interface directs users to avoid paying twice for the same refill. Tests cover partial refill, full stock, exhaustion, time correction, Undo, imports and insufficient funds.


## Additive people fields — 2026-10-05

Ship setup/settings now asks for separate middle-service and high-service counts and adds them for total people. Four middle plus two high is six people, Cr10,000 monthly person costs and two default luggage tons. This replaces the confusing total-plus-subset form; saved counts are read without adding the high group twice. Cabin counts and historical records are unchanged.


## Passenger labels and luggage correction — 2026-10-05

The form explicitly asks how many Middle passengers and how many High passengers. Crew remain included in these combined counts, as requested. Automatic luggage is exactly High count × 1 ton; the previous ambiguous saved per-person multiplier no longer controls combined-count campaigns. A separate opt-in total-tonnage override is editable, including zero. The summary shows the multiplication or marks an override. This restores the user's specified two-High-passenger reservation to two cargo tons. Historical payments remain unchanged.

RAW comparison: Core Update 2022 p. 154 charges Cr1,000 per ordinary stateroom plus Cr1,000 for each person outside low berths, with Cr100 per occupied low berth. High Guard Update 2022 p. 51 gives high staterooms a Cr3,000 life-support rate. Core pp. 158 and 238 provide 1 ton luggage for High and 100 kg for Middle. The campaign instead charges high cabins Cr1,000, High people Cr3,000, empty Low cabins Cr100, and no automatic Middle luggage. A high-passage ticket is not the same thing as the High Guard high stateroom option. Tracked supply days and the 28-day top-up model are campaign bookkeeping.

### Daily controls and whole-day supplies - 2026-10-05

Added -1/+1 day controls next to Campaign time. Forward time consumes accumulated whole days; backward corrections restore neither supplies nor transactions. History and Undo use the existing atomic state transition. Refill rounds a partially consumed day up and resets its counter without advancing campaign time. These are user-requested campaign accounting conventions, not new rulebook claims.

### Jump fuel tracking - 2026-10-05

Verified against Core Rulebook Update 2022: p. 157 consumes 10% of hull tonnage per actual parsec, with jumps shorter than one parsec counted as Jump-1; p. 154 gives refined Cr500/ton and unrefined Cr100/ton. Page 180 separates jump tankage from power-plant fuel. User scope excludes power-plant tracking. Whole-ton rounding and free water collection retain existing campaign conventions. Added bank/tank purchase audits, insufficient-fuel and overfill rejection, committed-jump consumption, optional legacy configuration and undo coverage.

### Zero-fuel expense selection - 2026-10-05

Selected fuel with exactly zero tons is omitted from expense previews and payment batches. Other selected expenses remain payable; fuel alone shows Nothing to pay. No fuel ledger entry or tank change is created. Positive-quantity free water collection still creates a zero-Credit fuel record. Invalid and over-capacity quantities remain rejected.

Refuel opens a fuel-only form and confirmation. Accounts supports manual deposits with a positive rounded Credit amount, required description, preview, ledger entry and undo. Browser checks cover deposit cancellation, persistence and undo, and isolated fuel purchase.

Unavailable fuel displays an accessible alert beside the source selector with valid alternatives and supplier-confirmation instructions. Availability checks share the same function as fuel pricing. Expense preview blockers use a prominent warning.

The summary labels total occupancy as Hold space used and separately lists owned trade goods, accepted freight/mail and passenger luggage. Delivered contracts do not occupy the hold. The goods table and its empty state explicitly distinguish owned goods from other hold occupancy.

Campaign fuel override: unconfirmed world fuel and insufficient tank fuel warn but do not block route planning or jump commitment. Jump range still applies. Commit consumes available tank fuel down to zero and records required fuel, consumed fuel and shortfall in the jump audit; undo restores the original tank.

Empty-space stops: select an empty hex with Build route (hex grid visible); confirm no world at the selected coordinates using Traveller Map. Saved empty stops have no market or starport services. Fuel bladders accept capacity directly in whole tons; legacy full-drive-range jump counts retain their equivalent tonnage using the saved hull and jump rating. Actual consumption still uses each leg distance. Campaign correction agreed 2026-10-06: only fuel above the base tank capacity uses cargo space. Empty bladders use zero cargo space; hardware is handled by ship specifications. The single-stock model fills base tanks first and consumes bladder fuel first. No installation charge is invented.


## Dedicated Mail controls (2026-10-08)

Scope: a compact Mail card and independent Check for mail on the existing Contracts → Freight & mail screen. Freight traffic and mail-band DMs are derived automatically; optional manual availability/container totals are separate; Settings remain the source for armed/rank/SOC. New endpoint audits preserve population, port, TL and zone components. Existing records remain readable without reconstructing missing components or live offers. Rules, rates and lifecycle semantics remain unchanged.

Validation on the feature tree, based on `edfd7ed221731f25d15741bf6df73ab4bb8f6f40`:
- `verification/mail.test.mjs`: 16 native tests passed. Covers every traffic-band edge, 11/12 availability threshold, origin TL boundary, armed/rank/SOC, independent manual/automatic rolls and invalid inputs, zero/long-distance mail, unchanged freight table limits, legacy schema-1 round trips, complete capacity reservations, origin/destination validation, single payout, release, Undo and profit/tax exclusions.
- `verification/mail-ui.test.mjs`: 21/21 passed. Application-function integration checks use the actual app source, real rules/state and mocked DOM/storage boundaries. Coverage includes standalone/combined checks, result and capacity states, read-only controls, manual-input audits, referee edits, explicit acceptance/delivery, session reset/reload, Cancel, replacement dialogs, stale previews, lock loss, duplicate submits and search/edit Undo. These are native control-flow checks, not browser verification.
- Existing map-overview, map-territory and map-viewport suites: 21/21 passed. Repository tool-visit test: passed. Rules source/data script: 198 assertions passed. Application/rules syntax and `git diff --check`: passed.
- Final native aggregate: 142/144 passed, including all 37 new mail checks. Two existing routing assertions in `verification/app.test.mjs` (lines 39 and 89) also fail at unchanged baseline `edfd7ed`; the mail change does not touch route code. They remain open.
- Browser/visual QA is **not completed**: the cloud Chromium process fails before loading the app with `socket() failed: Operation not permitted`. This blocks real layout, keyboard, focus, mobile and browser-storage verification here; the simulated DOM does not substitute for those checks. No deployment or live-site verification is claimed.


### Mail browser CI follow-up (2026-10-08)

The owner approved adding a GitHub Actions browser check to draft PR #4. `.github/workflows/mail-browser.yml` runs only on affected pull requests with read-only repository permissions, no secrets and no deployment steps. Official actions are pinned by commit; Playwright is pinned to 1.58.2. The runner checks out the exact PR head, runs the focused native/source-data checks, serves the app on loopback and runs `verification/mail-browser.test.mjs` in actual Chromium. Synthetic campaign fixtures and intercepted map responses isolate tests from user data and live API availability.

Screenshots, Playwright traces, a JSON case summary, logs and the tested revision are uploaded even after a test failure. Workflow execution and results must be verified for the exact head before claiming browser coverage. This addition does not turn the earlier local browser block into a pass and does not suppress or modify the pre-existing aggregate routing failures.


The first real Chromium run [37859944437](https://github.com/OwlsNestNH/Traveller-Tools/actions/runs/37859944437) passed all six Mail scenarios on head `c0a9ae6d149ef9d5cdd62e953ee285aceb7cafab`, with 37 focused native and 198 source/data checks also passing. Subsequent screenshot inspection caught narrow audit-label columns at 390px despite the existing no-overflow assertion. The Mail card now gives mobile labels and values bounded equal-width columns, and the browser suite explicitly checks readable label widths. Verify the updated head’s workflow before treating that visual correction as passed.


## Visible Mail rolls and explicit Audit (2026-10-08)

Follow-up scope: the saved availability dice/total + combined mail DM = final result against 12+ is visible without expanding details; the container roll is shown when recorded. Saved mail contract rows retain the same summary after reload. An explicit read-only Audit button exposes every recorded modifier, zero components, both endpoint inputs, distance/search Effect, freight-band mapping and rule sources. New mail checks snapshot search/world inputs; existing missing values remain labeled not recorded. No rule, price, acceptance or delivery behavior changes.

Focused native and real Chromium coverage is extended to verify visible collapsed summaries, automatic/manual/negative rolls, accepted historical rows, old/missing audits, the Audit button, saved-input stability and mobile audit readability. Browser evidence must be associated with this follow-up’s exact PR head; PR #4’s earlier passing run does not verify these new controls. The existing two aggregate routing failures remain separate and unchanged.

Local verification before publishing the follow-up: 46/46 focused Mail tests passed (17 rules/lifecycle plus 29 actual-app simulated-DOM tests), 151/153 aggregate native tests passed with only the two established routing failures, 198 rules checks passed, and changed JavaScript syntax / whitespace checks passed. The six real-browser scenarios are extended, but must run against the new PR head before browser success is claimed.


### Follow-up action row and collapsible shipment details (2026-10-09)

The visible-roll/Audit head `7407f9015609a64b6c6ee72be09bbd053c5759ad` passed all six real Chromium scenarios in [run 37862985427](https://github.com/OwlsNestNH/Traveller-Tools/actions/runs/37862985427). The owner then requested Check for mail beside Manual contract, matching light-blue button styles, and a collapsible accepted-Mail section. The supplied screenshot was inspected before these targeted layout changes.

The action row now contains one Check for mail button immediately after Manual contract. Accepted/delivered shipment details use a native expandable section; the outcome, route, recorded roll and Audit remain available while collapsed. Its open/closed preference is session-only and makes no campaign changes. Desktop/mobile placement, matching colors, collapse/reopen, tab-render retention and unchanged financial state are checked in the updated tests. The newest head must pass the workflow before these extra layout changes are treated as browser-verified.

Before the updated layout push: 47/47 focused Mail tests passed, 152/154 aggregate native tests passed (the two unchanged baseline routing failures), and 198 source/data assertions passed. The browser suite now has seven scenarios, including the new toolbar/disclosure flow; its result must be checked on the updated head.


### Political territory default (2026-10-09)

The seven-scenario Mail layout workflow [37864016591](https://github.com/OwlsNestNH/Traveller-Tools/actions/runs/37864016591) passed on `655fd2dd32dd0bc265aa24d96c05fc2922ebdea6`; the accepted/collapsed desktop and 390px screenshots were inspected. The owner then requested political territory on by default. New/unset browser preferences now default on, while an explicit off choice is saved separately from campaign JSON and survives redraws, reloads and campaign imports. Storage failure does not prevent using the toggle. Map geometry, route calculations and campaign data remain unchanged.

Local checks for this update: 71/71 focused Mail/map tests passed, 155/157 aggregate native tests passed with the same two baseline routing failures, 198 source/data checks passed, and changed JavaScript syntax/whitespace checks passed. CI now runs an eighth real-browser scenario covering the new default, off/on persistence and actual JSON import, plus the existing full map-overview browser regression. Those browser results must be verified against the updated PR head.

Run 37865638946 passed all eight Mail/map scenarios, including default-on and persistence/import checks. The additional map-overview regression stopped while its SVG was replaced during element screenshot capture. Capture now uses the page rather than a retained SVG handle; map assertions are unchanged. The full workflow is rerun on the correction’s exact head.


## Foundation reliability cleanup (2026-10-09)

Baseline `4ec6d71f91cd7428f85e7d760e85c82bb90dbecd` reproduced 155/157 native checks. Both failures were stale routing assertions from before commit `11b9e1926ef292f72ba5e2516880edb035906f35`, which deliberately replaced fuel blocking with the approved campaign warning. Existing fuel tests, UI warnings and the recorded campaign decision agree. The algorithm, fuel prices, financial rules and user defaults are unchanged. Updated assertions plus new cases cover unavailable supply at origin/intermediate/destination, empty mandatory stops, stable-ID ties, drive range, missing stops, the world cap and unchanged inputs.

Persistence regressions cover repeated takeover, cancellation while queued, latest-state handoff, stale previews, rejected locks, failing callbacks, no-lock browsers, rejected malformed imports without saved-byte changes, and populated/legacy schema-1 round trips with working Undo. The production changes are confined to these ownership/import boundaries and cache-busting their modules.

Local verification: 170/170 native tests and 198 source/data checks passed; JavaScript syntax, shared tool-visit tests and whitespace checks passed. Browser validation uses GitHub Actions because local Chromium is blocked in this environment. `.github/workflows/mail-browser.yml` now independently gates the entire native/rules suite and seven deterministic Chromium scripts (general app, modal lifecycle, click routing, fuel, empty space, Mail and map overview), without suppressing failures. Exact-head results and artifacts must be checked on the pull request; this local record is not a claim that browser checks have run or that the app has been deployed. Other browser scripts and live API availability remain outside this bounded gate.

## Pre-jump Mail cancellation (2026-10-09)

Based on published main `3256eaf21ca0751675855a944b250cbc769299a0`. This is an approved campaign convenience: cancel one accepted Mail consignment before its first committed jump, release its full reservation, and permit a new check without income or penalty. Core availability, freight, payments, visible-roll/Audit behavior and map defaults are unchanged. Cancellation retains the contract and audit and uses the established Undo/revision/writer boundaries.

Native coverage checks first-departure persistence, zero-hour and return trips, time/route corrections, new/manual Mail, whole-hold release/restoration, fresh acceptance, delivered/duplicate rejection, conservative legacy reconstruction, contradictory/incomplete/import-seam history, invalid lifecycle imports, and read-only/stale saves. Actual-app simulated-DOM coverage additionally checks modal dismiss/replacement/repeated submits and saved rows/cards. These are not browser evidence.

Before posting the draft PR, all 195 native checks, 198 source/data checks, the shared tool-visit suite, JavaScript syntax and whitespace checks passed. Local Chromium remains blocked by the execution environment; the seven-suite read-only exact-head GitHub Actions gate must run and its screenshots be inspected before browser verification is claimed. No deployment is authorized by this feature's draft PR.


## Whole Mail panel dropdown (2026-10-09)

Based on published main `9a70f3be827c7d4f3eb715319cdf814d151258f9`. The owner requested that the entire Mail panel collapse to save page space; the supplied screenshot was inspected. This is a presentation-only change. The native disclosure starts closed and keeps a compact status/tons/payment summary visible, including capacity/origin acceptance blockers. User-selected open/closed state survives ordinary renders, tab changes and new checks for this visit. The existing inner shipment-details disclosure and all pre-jump cancellation guards are unchanged.

Native actual-app tests cover initially collapsed/unchecked, available and unavailable results, current override terms, acceptance/cancellation/delivery summaries, stale inactive results, independent inner/outer toggles, ignored detached events, read-only audits, session-only state and unchanged saved campaign/dice. Existing snapshot, modal, financial and lifecycle tests remain in the full regression gate. Before draft posting, all 198 native tests, 198 rules-data checks, shared tool-visit checks, JavaScript syntax and whitespace checks passed. These simulated-DOM tests are not visual/browser evidence. The seven independent exact-head Chromium suites must pass in GitHub Actions, and the new desktop/mobile collapsed/expanded screenshots must be inspected before browser verification is claimed. The draft PR does not deploy the app.

## Mail history cleanup and compact ledger (2026-10-09)

Based on published main `e49016e` (whole Mail panel collapse). Approved scope: remove cancelled Mail rows from the main contract list while retaining History/Audit/Undo, replace the visible result when Mail is checked again and mark prior checks superseded without rewriting their rolls, and reduce Bank-ledger row height with Details beside the Entry label. Existing accepted/delivered contracts, freight, payments, map defaults and whole-panel disclosure behavior are preserved.

Native checks cover immutable supersession links, latest-reference Undo branches, legacy/current imports, malformed references, stale session offers, cancelled-record archive fallback, capacity restoration and unchanged accounting. Real Chromium coverage adds repeated checks, saved read-only results, main-list row absence, archive audits, two-tab updates, and compact ledger geometry, keyboard actions and desktop/mobile screenshots. Exact-head CI and screenshot inspection are required before reporting browser verification; local Chromium remains blocked by the known environment socket restriction. The previously observed map SVG screenshot race is not claimed fixed by this UI change.

Before the draft PR: 225/225 native checks, 198 source/data checks, the shared tool-visit suite, JavaScript syntax and whitespace checks pass locally. Review caught and fixed hidden-tab and same-reference import offer reuse: all external/acquire/replacement updates invalidate session drafts before reconstructing read-only results, while this tab's own commits preserve ordinary freight drafts. Ledger Details is first, then the Entry text. Browser results remain pending the exact-head workflow.


## Pre-GUI metadata and map preparation (2026-10-09)

Based on PR #9 merge `ee77f6d7a95928bb02da59cf76faf73ebbc35b56`. This changes presentation-helper metadata, stale explanatory rounding copy and shared map geometry only. Financial engines, campaign schema/storage, saved action labels, modal/Undo lifecycle, browser preferences and current map size/extent remain unchanged. `GUI_PARITY.md` records future control homes; it is not evidence that the future GUI has been implemented.

Before draft posting: 234 native tests and 198 source/data checks pass. Added native cases cover renamed unit labels/input names and modal titles, explicit optional-rule flags, Cr1/Cr100/refunds/zero/blank/disabled entries, fractional claim exemption, unchanged Cr101 × 75% = Cr76 and 1% × Cr1,001 = Cr11 examples, exact visible-load bounds and 18 pre-preparation SVG projection/clipping snapshots. The seven existing exact-head Chromium suites remain the browser gate. Their new assertions cover a real renamed-label/review-title deposit cancel/commit/Undo, insurance audit wording, all map levels and unchanged desktop/mobile map geometry. Local Chromium cannot launch due to the execution environment's socket restriction; remote browser results and screenshots must be checked before claiming browser verification. This draft does not authorize merge or deployment.


## Passenger contracts and legacy baggage compatibility (2026-10-09)

Based on released .26 merge `946c131f9907d9090dd59510ef24560078956cf0`. Core Rulebook Update 2022 printed pp. 158, 238–239 were independently inspected, including the passenger fare and traffic tables; p.154 supplies the occupied Low-berth rate. Checked-in passenger data retains a separate `passengers-1` data revision. Passenger traffic uses its own table and population/zone modifiers, not freight's; no TL modifier applies.

App conventions: generated bookings are restricted to one reachable jump; payment occurs once on explicit destination completion. Preserve existing High sharing/Cr7,000 example, Middle baggage override, standard cabin/person costs and whole-ship luggage overrides. New Low bookings use physical berth occupancy and Cr100/month; existing baseline frozen billing remains unchanged. No freight penalties, speculative tax/profit changes, automated mortality or lottery fees are added.

The compatibility fix preserves legacy explicit zero/custom luggage totals lacking `luggageMode` when saving unrelated Settings; modern automatic behavior remains unchanged. This is covered by actual-source Settings tests and the new browser script.

Final pre-PR local verification: all 491 native tests and 227 source/data assertions passed, together with shared tool integration, syntax and whitespace checks. Independent arithmetic/state/lifecycle review found no remaining blocker; its delivery luggage-override clarity request is fixed and tested. Additional browser scenarios are implemented but have not yet run. The complete exact-head browser workflow, including `passengers-browser`, and screenshot inspection remain release requirements. This entry is not a claim of publication, deployment or completed browser verification.

Exact-head first CI pass (`7d4dd265`): native/rules checks, the passenger browser suite, 24 other browser suites and all six five-trip campaign stress jobs passed. Cargo Hold caught a presentation regression: a zero Basic-accommodation row altered the legacy no-booking breakdown. That empty row is now omitted; nonzero passenger space remains displayed and counted once. Screenshot review also caught long unbroken destination names crossing offer-card boundaries; they now wrap within each card, with a browser geometry assertion. The updated local gate passes 492 native tests and 227 rules assertions. Final-head full browser results are still required after these presentation fixes.

## Approved code-audit repairs (UI 2026.10.09.28)

This update addresses the nine remaining findings from the .26 source audit and preserves the passenger/luggage compatibility work introduced in .27. It does not recalculate saved transaction audits or rewrite campaign data on load.

- Optional insurance premiums and related supplied numeric fields are checked before import replacement. Saved quantity-roll DMs, dice, multipliers and tons must have their recorded numeric types. Missing legacy optional policy fields remain supported. Monetary and quantity-audit renderers encode values independently of validation.
- Offer repricing uses the submitted illegal flag on the first save. Sale local-ban legality consistently controls the price-cap exemption, normal-value benchmark, buyer eligibility and audit while retaining an explicit manual price and the original dice.
- Historical fractional cargo can sell its exact remaining amount. Other newly entered quantities keep the whole-ton roundup rule. Full and partial sales, reload and Undo are covered for 0.5- and 1.5-ton lots.
- Build route reserves each selection before map lookup, preserving click order across reversed responses and already-known worlds. Auto plot retains the newest destination. Failed selections can be retried or removed; pending lookups block saving, and cancel/import/revision/ownership changes invalidate stale responses. Keyboard Enter and Space use the same visible asynchronous-error path as mouse activation.
- Traveller Map U/Unabsorbed and F/Forbidden normalize to Amber and Red, matching published symbols and the freight, mail-derived traffic and insurance calculations. Explicit saved referee overrides and historical transaction audits are preserved. Sources: [Second Survey travel zones](https://travellermap.com/doc/secondsurvey#travel-zone) and [Traveller Map World.cs](https://github.com/inexorabletash/travellermap/blob/main/server/World.cs#L257-L258), checked 9 October 2026.
- Cargo corrections after policy arrival proportionally reduce remaining policy tracking; full removal closes the ended policy. Original terms, premiums and claims are unchanged, no insurance payout is invented, and Undo restores the cargo and policy state while retaining the existing permanent closure of the previous jump mulligan. Active or amendment-required policies still require explicit close/amend before direct corrections.
- New freight delivery ledger entries retain the actual late-penalty die. Older entries use a matching delivered-contract fallback, otherwise show “Not recorded” for a late payment and “Not required” for an on-time payment. All six die faces and the exact-deadline boundary are covered. A zero-credit freight settlement remains visible in Accounts so its 100% penalty can be audited.
- The shared dialog is named by its visible heading with `aria-labelledby="modal-title"`.

Local integration gate: **552 native tests and 227 rules-data/expected-result checks passed**, plus the shared tool-visit test. A separate read-only review of the audit repair implementations independently passed 134 focused tests before passenger integration. Added browser suites `route-selection-browser` and `trade-audit-browser` are included in the 28-suite Chromium matrix; the existing insurance browser suite also tests invalid numeric imports, ended-policy corrections, late-freight detail dialogs and accessible names.

Final exact-head Chromium, stress and post-integration independent review are release gates and must be checked on the PR before merging. Local Chromium could not launch in the cloud sandbox, so authored/syntax-checked browser tests are not counted as browser passes here. Regression inputs are disposable synthetic data, plain invalid types and inert punctuation. No browser exploit, runtime security proof or full screen-reader/assistive-technology pass is claimed.

First exact-head CI (`b2f8590051974f024bd6dcc7961671fe2c3efb5a`) passed the native/rules job, 25 of 28 Chromium suites and all six five-trip campaign stress jobs. The new insurance check caught a zero-credit freight settlement hidden by the ledger filter; that row now retains its Details control, with an explicit negative control for unrelated zero charges. Its Undo assertion now respects the existing append-only jump-mulligan closure. The route trace passed ten checks before a background map repaint replaced the focused SVG; setup now waits for the finite startup fixtures and keyboard events target the current hex. All behavioral assertions remain. The world-screen trace showed the measured map below the live viewport while the full-page image and DOM coordinates fit; the harness now brings it into view before measuring and records raw vertical bounds on success or failure, without changing any tolerance. The failing getBBox result was not recorded, so the offscreen/stale-geometry explanation remains a hypothesis pending the rerun. Updated exact-head browser results are required before merge.

## Global planet-name search (2026-10-10; UI 2026.10.10.29)

This is a browse-only navigation extension; no trade, travel, payment or campaign rules change. The base includes the merged test-only world-label lifecycle repair at `9218b510ceea99f77cf25bd3e5c24de6d02ce7fb`.

API source verification: [Traveller Map API](https://travellermap.com/doc/api), [SearchHandler](https://github.com/inexorabletash/travellermap/blob/main/server/api/SearchHandler.cs) and [SearchEngine](https://github.com/inexorabletash/travellermap/blob/main/server/search/SearchEngine.cs). Search uses `types=worlds`, `q`, and explicit `milieu=M1105`; results have sector and hex coordinates, so subsector names are joined from metadata requested by sector coordinates. The server cap is 160 with no pagination; returned count is not a total-match count.

Live read-only calls on 2026-10-10 verified Regina → Regina / Spinward Marches / 1910, plus prefix matches Reginald and Reginante. `exact:Terra` returned three distinct locations: Maria / Iphigenaia / 1221, Terra / Outer Reaches / 2627, and Sol / Solomani Rim / 1827. These are live API checks, separate from deterministic fixtures.

Native `global-search.test.mjs` covers coordinate identity, duplicate names, four-digit hexes/subsector boundaries, M1105/world-only URLs, authoritative names, four-request metadata concurrency and caching, failed/unnamed metadata, search caps, malformed/empty responses, aborts, debounce/explicit search, late success/failure, duplicate clicks, edits during exact/nearby loads, close/reopen invalidation, mixed global/legacy control ownership, stale legacy errors and retries. Independent source review caught and corrected overview-scale browsing so the selected planet is highlighted, plus shared-modal races so the newest selection wins across all three Find World actions. Legacy browsing now waits for nearby loading before changing the view.

`global-search-browser.test.mjs` is included in the read-only exact-head Chromium matrix. It checks keyboard input/result selection, duplicate names, state-byte invariants with a nonempty campaign, query/selection races, dismiss/reopen paths, failures and retries, Current system, preserved existing selectors, and 1440/390/320px long-name screenshots. Exact-head browser and full regression results must be checked before release; a local Chromium launch is unavailable in the current executor.

The first exact-head Chromium run on `24d165e` passed 43 global-search/state checks before finding that Escape in Chromium’s native search input cleared the query instead of closing the dialog. The search input now explicitly delegates Escape to the existing modal dismissal path. The original browser assertion is retained, with an added native key-handler regression. Remaining browser scenarios and the complete replacement-head gate must pass before release.


## Approved campaign controls (2026-10-10; UI 2026.10.10.30)

- Saved insurance OFF hides new purchase and held-cargo coverage controls and rejects both new-coverage model entry points before mutation. It does not re-enable itself. Existing policies, claims, amendments, closed-policy History and Undo remain available. Uninsured purchase previews omit the inapplicable premium row.
- Bladder capacity is entered in tons, independently of drive rating; old jump-count saves are read without changing their retained Undo patches. Two legacy extra jumps on a 200 t Jump-2 hull remain 80 t; new input 2 is 2 t. New capacity, actual fuel occupancy, loaded cargo and shrinking/removing equipment have specific validation. Empty equipment consumes no cargo. Compact Overview labels distinguish Aboard, base Tank and Bladder capacities while preserving aligned bars.
- Contact penalties follow the approved Home Rule / campaign interpretation: one grouped 28-day period per planet, anchored by its first committed search's start. All prior supplier/buyer attempts count across methods and counterparties; the complete group resets at the period end. Preview/cancel creates no attempt. Core's wording remains “same month”; it is not asserted to explicitly specify this 28-day grouping. Historical results are not recalculated, and the independent rejection cooldown remains 720 hours.
- Cargo Hold uses the same Overview MFD button class as the other services, including selected/focus/disabled presentation. No broader GUI or information-marker framework is introduced.

Local evidence: all native tests, rule-data checks, shared tool integration and module syntax were run. Exact counts and final tested revision belong to the release record. Browser regressions cover insurance OFF and preserved policy lifecycle, bladder migration/settings/Undo and compact readout at 320/390/1100/1440 px, contact period boundaries/import/Undo, and Cargo Hold button parity. Local Chromium execution is unavailable because the cloud shell blocks required local sockets; the exact-head GitHub Actions browser matrix is required before publication and is not represented here as passed.

Integrated on merged global-search main `a953ae5d40a1b6a7d6444c9ff20f6b687c56c945`, preserving the latest-intent and Escape-dismissal fixes. Both global-search and contact-search modules participate in the .30 cache-token check.

## Stage 1 display and form-value extraction (2026-10-10; UI 2026.10.10.31)

This behavior-preserving cleanup moves shared text escaping, explicit Credit
display variants, and metadata-driven amount normalization into `display.mjs`
and `form-values.mjs`. Feature markup and the existing HTML/text sink contracts
remain unchanged. No pricing, campaign-write timing, trade-session ownership,
saved schema, passenger, map or search behavior is redesigned.

The release baseline is merged PR #31, commit
`0c1413ae03e4bed79d6bc6693063f2a03820f91c`, tree
`2dd2d5feee94271f38bdf259a38da437bc4adddf`, after the global-search release.
It preserves the final controls correction that supplies full ship context to
legacy refuel forecasts and its native/browser regressions.
Fifteen focused characterization tests passed before extraction. The same
display/value assertions now use ordinary module imports; additional direct
tests cover blank/disabled inputs, repeat normalization, sequential partial
failure and retry, Settings annotation ownership, exact 0.5/1.5-ton remainders,
malformed text, nulls and Credit strings beyond safe floating-point precision.

Local verification passed **619 native tests across 50 suites**, **227 rules/data
checks**, shared tool integration, module syntax and whitespace checks. Release
checks include both new modules, their dependency cache tokens and the complete
static module graph under the GitHub Pages project subdirectory.

The existing `modal-lifecycle` Chromium suite now loads the new helper assets
through the running release URLs and checks inert HTML text, exact large Credit
strings, Cr1/Cr100 native input validity, disabled/empty fields, fractional
remainders and repeat normalization without changing campaign state. Existing
deposit commit/cancel/Undo, fractional full/partial sales with reload/Undo,
service, passenger, responsive and global-search browser gates remain required.
No local Chromium launch was attempted because required sockets are blocked in
this executor. Final exact-head Actions results and deployment verification are
still release gates; this entry does not claim they have passed.

## Expanded Overview map (2026-10-10; UI 2026.10.10.32)

Based on released Stage 1 merge `b656454c498e0061545ed505aa969aacc76c7947`.
The entire navigation unit can span the Overview, with a wider and taller
measured viewport. Zoom, world spacing, camera center/pan, browsing selection,
actual ship location and route are retained. Restore returns the normal panel
layout. Service draft cancellation remains explicit; receipts are restored
without repeating or reversing payment. This is view state, not a rules change.

Native source-executed tests cover repeated toggles, unchanged campaign/camera/
route draft, unpaid confirmation/cancellation, saving guards, receipt identity
and reload preference, restored panel destinations, and expanded map bounds.
`expanded-map-browser` is included in the exact-head read-only Chromium matrix
and verifies desktop/mobile geometry and interrupted navigation. Local browser
launch is unavailable because this executor blocks required sockets; browser
results and actual screenshot review remain release gates until CI completes.

Local verification passed **628 native tests across 51 suites**, **227 rules/data checks**, shared tool integration, every application module syntax check, and whitespace validation. Independent source review approved the implementation after the expanded view’s Ship services accessibility targets were corrected. Browser results remain pending the draft PR gate.

## Contextual rule references — UI 2026.10.10.33

Display-only change based on the expanded-map release candidate. The 29-entry
reference catalogue has an independent source/content review against the
examined Core Rulebook Update 2022 revision, selected Cluster Truck physical
LSS mechanics and the complete Book 7: Merchant Prince (First Edition, 2010)
source. This is a provenance/description check, not a new transcription or an
exhaustive recheck of every commodity/table cell.

Correct source distinctions retained:
- Core pp.241–243 supplies “same month” search wording; the grouped per-planet
  28-day committed-search clock is a campaign interpretation.
- Core pp.184–185 describes bladder hardware; the app's direct-ton capacity and
  unified fuel bookkeeping are its approved campaign model.
- Merchant Prince insurance spans pp.82–83. Tax discussion is p.86 and the
  table p.87. The printed Cr75,001–76,000 gap is covered by approved INT-009;
  no publisher-erratum claim is made.
- Cluster Truck (Mongoose Publishing, ©2026) p.14 supplies selected physical
  consumption and storage figures. Campaign support prices remain separate.
- Broker rounding is INT-001; local illegality's source mechanism is Core p.243.
  INT-003 concerns black-market stock. INT-024 retains the largest absolute
  commodity DM's sign, with its approved positive tie-break.

The implementation preserves dice, modifiers, amounts, resource consumption,
search periods, booking terms, schedules, campaign schema, storage and Undo.
No private source locations, scans, PDFs or copied source passages are shipped.
Markers add no event-specific information beyond the audit they accompany.
Future shared-viewer authorization remains outside this local UI pass.

Native reference/controller tests cover catalogue completeness and provenance,
read-only markup, replacement-opener focus, isolation from a transaction,
activation timing and repeated-click guarding. The normal aggregate native,
rules-data and repository integration checks apply. The new
`rule-references-browser.test.mjs` is included in the exact-head CI matrix and
covers 1440/1100/390/320px screenshots, all 29 references, native dialog focus,
keyboard/touch, dirty-input blur, read-only handoff, saved/legacy audits and
expanded-map coexistence. Actual browser and visual verification must pass on
the final release head before publication; the presence of this record alone
is not that result.

## Individual World Changes history — local implementation, 2026-10-10

Based on the source tree deployed by merge `29a36939d3c2d7fa34021302d26d0cbd25c8262d`
(UI .39). This is a campaign editing/audit feature, with no new published-rule
interpretation. World Changes is readable in existing read-only tabs. New
versioned audits permit guarded restoration of one field, including one UWP
digit, without rewriting later unrelated values or historical economics and
travel. Old incomplete entries retain their evidence and have no inferred
selective restore. Existing jump protection remains enforced; an attempted
protected History Undo now explains its refusal.

The focused native suite covers all eight UWP components, other editable world
fields, source/action/Undo linkage, legacy and unknown extra history, import
revision rebasing, stale previews, writer handoff, cancellation, duplicate
confirmation and classified/unclassified persistence faults. Independent review
identified an import-linkage gap; summary pairing and replayed Undo suffix
validation were added to reject swapped links and missing/mislabeled summaries.
The final native aggregate and exact-head CI results must be recorded against
the release candidate before publication.

The new `world-change-history-browser` CI job covers actual History filtering,
individual restoration, unchanged later world fields and transactions,
cancel/repeated clicks/reload/Undo, protected-jump refusal, read-only takeover,
legacy notices and 1440/390/320px evidence. Existing jump/fuel browser assertions
now exercise the warning rather than expecting only a disabled History button.
Local Chromium cannot launch in the current restricted executor (`socket()` is
not permitted); no local browser or visual pass is claimed. Browser CI and
independent screenshot review remain required.

Local .40 release-candidate checks: 901/901 native tests, 227/227 rules/data
checks, the shared tool-visit check, JavaScript syntax and whitespace checks
passed. Independent source review reported no remaining blocker after the
source/action linkage correction. Browser and visual gates remain pending;
this record does not claim deployment or live runtime verification.

## Dashboard .41 verification scope

Dashboard adds presentation and a saved reporting boundary, not a new Traveller rule or accounting transaction. The common recorded-operating-result helper retains the TXT report's existing formula and exclusions. Local verification covers exact cash reconciliation, opening/current boundaries, category totals beyond individual input width, visit attribution, missing profit audits, Undo, writer ownership, failure/publication retry and unchanged economic/history fixtures. The source/data check remains 227 checks. Real Chromium evidence for the exact release candidate is produced by the `dashboard-browser` matrix job; local cloud Chromium launch was blocked by its socket environment, so source/native results alone do not claim browser verification. Merge and deployment remain gated on actual browser results and screenshot review.

## Jump save-completion .42 verification scope

This is a UI save-boundary migration, not a rules change. The controller and
state calculation layer retain their existing synchronous behavior, prepared
roll persistence/reuse, jump audit and one-mulligan policy. Native and actual
Chromium cases cover delayed preparation and commit, exact fuel/LSS/cargo/mail/
insurance state, revision and editor loss, repeat activation, typed elapsed
hours, known unsaved versus saved/unknown failures, partial display failure and
reload. The existing full native/rules and campaign browser gates still apply.
Actual exact-head browser results and independent screenshot review are required
before release; this scope record alone is not a verification result.

## Undo save-completion .43 verification scope

This caller migration changes no Traveller rules, state inverse, audit retention,
world-field correction linkage, fixed Dashboard starting point or one-mulligan
policy. Its tests must cover immediate and delayed generic Undo/Undo Jump, exact
restored campaign values, known-unsaved retry, saved/unknown failures, repeated
activation, same-revision foreign publication, editor loss, pending display
failure, cleanup failure and reload. Generic Undo remains immediate, and campaign
replacement is excluded. Full native/rules/browser gates and independent source
and exact-head screenshot review are required; this scope is not a pass claim.


## Replacement save-completion .44 verification scope

Import/reset must preserve exact incoming economic/history/Undo data while
Store rebases revision and retains or establishes its existing Dashboard
baseline. The new native and actual-browser suites cover confirmation/cancel,
backup acknowledgement, synchronous and delayed completion, publication before
fulfillment, known-unsaved retry, saved/unknown failure and reload, duplicate or
detached submission, foreign same-revision publication, editor loss/reacquisition,
newer dialogs and out-of-order file reads. Provenance tests cover wrong/replayed/
retired tokens and normal/recovery Store paths. No Traveller rules change.
Full native/rules gates, exact-head browser CI and independent source and actual
screenshot review remain required; this scope is not a pass claim.


## Settings save-completion .45 verification scope

This is an inline/modal Settings save-boundary change, not a Traveller rules
change. Retain the original settings mutator, exact fuel/LSS correction and
complement behavior, mortgage/maintenance audits, rounding, bank/ledger/cargo/
contract/policy/route/time values, one revision and Undo record, fixed Dashboard
baseline and existing later-change mulligan closure. Native tests cover the
production modal/controller/Store boundary and preparation notification; actual
Chromium must prove inline form suspension/remount, disclosure retention,
pre-Revert usability after stale completion, controls and focus. The native DOM
double does not certify those inline browser behaviors.

Focused coverage includes synchronous/delayed save, publication before
settlement, repeated or detached handlers, known rejection and input correction,
foreign same-revision publication, lost/reacquired editor, dirty inline draft
plus legacy dialog, missing/wrong publication, contradictory provider errors,
render/focus/close/partial-pending-screen faults, reload and Undo. Full native,
rules, existing browser regressions and independent source/actual screenshot
review remain required. This scope entry is not a pass or deployment claim.


## Setup/location save-completion .46 verification scope

This caller migration changes no Traveller economic or travel rules. Compare
synchronous and delayed setup/location candidates, including normalized money,
rounding, existing life-support anchoring, opening Dashboard baseline, correction
audit, insurance route amendment and consumed-mulligan behavior. Setup creates
one opening bank ledger entry/revision/Undo record; Undo then fresh setup retains
the existing baseline replacement rule. Location does not advance time, travel,
consume fuel or pay contracts, and a same-world refresh remains zero-write.

Cover lookup/validation cancellation and retry, actual picker failure/retry,
pending provider success/failure, publication before fulfillment, duplicate and
detached actions, stale disk, foreign same-revision state, lost/reacquired editor,
wrong/missing provenance and contradictory result classifications. Partial-dialog,
cleanup and reporting faults must not navigate or allow replay. Post-save setup
nearby failure is ancillary, never another setup opportunity. Native tests use
production callbacks/controller/Store; real desktop/mobile Chromium must check
field retention, gestures, native locks, reload/Undo, visible warnings and layout.
Full native/rules/catalog gates, existing browser regressions and independent
source plus actual screenshot review are required. This scope is not a pass claim.
