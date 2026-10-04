# Traveller Trade Route Calculator — V1 Requirements

[Rules verification status and evidence](RULES_VERIFICATION.md)

Status: initial implementation 0.1.0 is available. Source/data checks and initial automated application tests passed; campaign playtesting remains open. Continue to ask the owner when new rules ambiguities arise.

## Authority and scope

This document captures the authoritative product decisions from the design process and project request. Implementation must use the checked-in GitHub documents; it must not require access to that chat or the user's personal references. Implement Traveller rules against the Core Rulebook, with the reduced-profit setting explicitly identified as a house rule.

The existing `tools/spec-trade/` tool is buggy and untrusted. It must not serve as rules authority. Any reused code or data must be independently verified against the Core Rulebook. Record the edition and rule references during implementation; do not invent missing tables or formulas.

V1 is a free-only static web app in this repository. All app code, verified rules data, and supporting documentation must be checked into GitHub. The deployed tool must not access, embed, link to, or require the actual rulebook PDFs, the user's private files/accounts, or the design conversation. Rulebook verification is a development activity; record concise rule provenance in GitHub without bundling PDFs or personal reference links. Passengers and the deferred features in [BACKLOG.md](BACKLOG.md) are excluded.

## Rules verification before implementation

The intended V1 baseline is Traveller Core Rulebook Update 2022. During the verification step, confirm the source's title, edition/update, and any applicable errata before marking rules data verified. Do not mix editions or supplement rules implicitly.

Before implementing the trading engine, check in a versioned structured rules dataset, a rules-source document with edition/page or table references, and worked examples with expected results. Cover UWP-derived trade codes, commodity availability/tonnage, purchase/sale tables, applicable DMs and their combination rules, brokers/fees, illegal goods, freight/mail, and travel/date handling. Include decimal cargo quantities, rounding boundaries, and partial-lot cost allocation in the examples.

Record unresolved rules as unresolved; do not substitute the old spec-trade implementation or guessed formulas. Version 0.1.0 has completed the recorded source/data gate; see [verification evidence](RULES_VERIFICATION.md). Ask the project owner to resolve ambiguous rules before adopting an interpretation. Record the question, alternatives, chosen conclusion, date and affected calculations in GitHub; silence is not approval. Keep unresolved interpretations visibly pending. The PDFs are development reference material only and must never be committed, linked as personal references, or accessed by the deployed app.

## Worlds, map, and route

- Use the Traveller Map public API for live world and navigation data.
- Provide a clickable local world map for selecting and inspecting worlds.
- Parse UWP locally and derive trade codes locally from the effective UWP. Allow editable UWP overrides and display the original and effective values clearly.
- Automatically find a route from the selected start to end world using **Fewest jumps**, the single V1 route mode. Respect ship jump capability and the fuel-availability validity checks. Among equally valid routes with the same jump count, prefer the least total distance; use stable world identifiers to break remaining ties reproducibly.
- Let the user insert, remove, or reorder mandatory intermediate stops. Find connecting routes through those stops in the chosen order and revalidate after each edit. Distinguish mandatory stops from automatically chosen intermediate worlds; committed travel history must remain intact when replanning the remaining route.
- If no valid connection is found within the searched world data, explain which segment failed and the search boundary; do not present an incomplete route as valid. Planning does not relocate the ship. COMMIT JUMP must start at the ship's actual world.
- Route validity considers ship jump capability and fuel availability at relevant stops. V1 does not simulate fuel consumption or maintain a fuel-use ledger.
- Keep the viewed world separate from the ship's actual current world. Previous/next world controls browse the route for inspection and planning; they do not move the ship, advance the date, or deliver contracts.
- Use an explicit **COMMIT JUMP** action to move the ship along a valid leg and record the resulting location, date, and history. Date/jump handling must use verified rules and preserve the applied elapsed time for audit.
- Maintain an editable campaign date and support recording time spent between jumps. A route edit or world preview must not silently advance campaign time.

## Ship-computer interface and state

Use a ship-computer interface with readable world, route, market, cargo, accounts, and history views. Show actual location and browsed location distinctly. Maintain ship, trader, bank balance, cargo capacity/usage, campaign date, route progress, and profit-mode state. Trader and ship inputs must supply the verified rules calculations and route/capacity checks.

The app must include a visible **Rules verification** link to this project's public GitHub verification record. The record must state whether verification is pending or complete; linking to it must not imply that unverified rules have passed review. Keep this link available from the per-commodity DM audit view as well.

The [interpretation decision register](RULES_REVIEW.md#interpretation-decision-register) records approved rules interpretations. Apply agreed entries by their revision; pending entries are not defaults.

## Rules & Notes panel

Provide a small, consistently available **Rules & Notes** button (working label). It opens an accessible panel with:

- **Rules and verification:** source title/revision, printed page or table references, running rules-data version, and the public GitHub verification link with its actual status.
- **Interpretations and assumptions:** each ambiguity, the owner's agreed conclusion and rationale, affected behavior, decision date and stable decision ID. Pending questions stay clearly marked and must not be presented as agreed rules.
- **House rules:** Reduced/Custom profit modes, rounding and other app-specific policies, clearly distinguished from source rules.
- **Copyright and credits:** accurate source/publisher attribution, actual applicable license/permission notices, Traveller Map attribution and relevant project credits. Do not invent permission claims or reproduce rulebook pages.
- **About:** application version, concise scope and relevant limitations.

Link affected calculation audit entries directly to the relevant interpretation or house-rule note. Keep the existing Rules verification link available from the commodity audit. The notes must be readable from bundled GitHub content without PDF access, a private account, or this conversation.

A changed interpretation gets a new revision. Historical market snapshots and transactions retain the interpretation versions used when created; later decisions must not silently rewrite past results.

## Starting balances and referee corrections

- Allow a campaign to begin at its current world/date with an opening bank balance and separate existing cargo lots. Each opening lot records commodity, description, legality, quantity, and its remaining acquisition cost basis (including acquisition fees); original world/date may be recorded when known.
- Record opening balances/lots as setup entries, not fabricated historical purchases. Do not debit the opening bank for cargo already owned. Validate quantities, capacity, and cost basis before saving setup.
- Allow explicit bank and cargo adjustments for referee awards, loss/theft, damage, and bookkeeping corrections. Require a reason, record the effective date/world, and retain before/after values and affected lot IDs in the ledger/history.
- A cargo adjustment must explicitly reconcile quantity and remaining cost basis. Preview any basis written off or added; do not silently treat removed cargo as a sale, award sale proceeds, or apply the reduced-profit rule to an adjustment.
- Keep historical purchases/sales intact; corrections create new entries rather than overwriting past evidence. Support undo with consistent bank, cargo, and basis restoration.

## Long lists and responsive layout

- On desktop, market and cargo panels grow to a comfortable maximum height, then scroll independently without reducing text size. Keep their column headings visible while scrolling.
- Aim for about eight visible market rows and five to six visible cargo rows in the dashboard, adapting to viewport height. These are layout targets, not data limits: every entry remains reachable.
- Provide market search and filters for Active, Expired, and Illegal offers. Show total and matching counts; filtering affects only the view, never offer state.
- Provide a **View all N lots** link from the cargo panel to the full Cargo tab, with a larger searchable, sortable table. Preserve each lot's identity, even when commodities match.
- Keep the selected lot's sale preview visible while the desktop cargo list scrolls. Sorting or filtering must not silently change the selected lot or commit a transaction.
- Keep bank balance, cargo capacity, actual location, and COMMIT JUMP easy to reach as lists grow. A long market or cargo list must not push the desktop jump control out of its navigation area.
- On smaller screens, stack panels and favor normal page scrolling over nested vertical scroll areas. Preserve readable labels and access to all controls.
- Use scrolling rather than pagination for lists of 10–15 entries.

## Trade data table UI requirements — 2026-10-04

Screenshot feedback from the Trade Calculator Design discussion prompted this clarification: show the normal retail/base price and the percentage from the 3D modified-price table, and align column headings with their values. These are requirements for a future UI update; this documentation change does not implement them. The screenshot itself is not included.

### General table layout and audit behavior

- Use the exact column order and labels specified below. Headers and body cells must share fixed or consistent grid widths so each label aligns with its values, including while scrolling.
- Left-align commodity names and lot descriptions. Right-align all tonnage and currency headers and values. Right-align **Price %** consistently in both purchase and sale tables.
- Give the **Actions** column a fixed width and use consistent button sizing. Keep status labels clear and each checkbox together with its label in the same status cell.
- Use **Purchase Price** and **Sale Price**, not a vague **Cr/ton** header. Make units explicit in the displayed values or supporting labels: tons, Cr/ton for unit prices, and Cr for total revenue.
- Preserve modifier auditability from every row. Audit or Audit/View must identify that specific offer, cargo lot, or freight contract and expose its saved inputs, rolls, applicable DMs and sources, table result, overrides, and effective result. Preserve original calculations and edit history; editing must not silently overwrite historical evidence.
- Keep existing responsive, sticky-header, filtering, and stable-row-selection requirements. Narrow layouts must retain readable labels and access to every column and action.

### PURCHASE OFFERS

Required columns, in order:

| Commodity | Available | Retail | Price % | Purchase Price | Offer Status | Actions |
| :--- | ---: | ---: | ---: | ---: | :--- | :--- |
| Commodity name | Available tons | Core Rulebook base price (Cr/ton) | 3D purchase percentage | Final purchase price (Cr/ton) | Active/Expired and Expired checkbox | Buy, Audit, Edit |

- **Retail** is the Core Rulebook base price, displayed separately from the negotiated purchase price.
- **Price %** is the percentage result from the 3D modified-price purchase table, not the dice total, supplier-search result, or profit-mode percentage.
- **Purchase Price** is the final Cr/ton; preserve the table result and any price override in the row's audit.
- **Offer Status** shows **Active** when the **Expired** checkbox is unchecked and **Expired** when checked. Keep the checkbox and its label together.
- Visually dim expired rows while keeping their values readable and their Audit/Edit controls available. Disable Buy for an expired offer; retain existing reactivation, history, undo, and purchase-validation rules. Expiration must not remove the row's audit evidence.
- **Actions** contains **Buy**, **Audit**, and **Edit** for the individual offer.

### CARGO SALE

Required columns, in order:

| Commodity | Tons Held | Retail | Price % | Sale Price | Lot / Description | Actions |
| :--- | ---: | ---: | ---: | ---: | :--- | :--- |
| Commodity name | Tons held in this lot | Core Rulebook base price (Cr/ton) | 3D sale percentage | Final sale price (Cr/ton) | Lot identity and description | Sell, Audit, Edit |

- **Retail** is the base price. **Price %** is the percentage from the 3D modified-price sale table. **Sale Price** is the final Cr/ton, with any override separately traceable in the audit.
- Support multiple lots of the same commodity as distinct rows, each with its own description and cost basis. Never merge lots by commodity name or replace acquisition cost basis with Retail or Sale Price.
- Automatically populate this table only with cargo actually aboard. Explicitly entered manual commodity lots may also exist through the existing setup/adjustment workflow, retaining their own description, quantity, cost basis, and audit history.
- **Actions** includes **Sell**, **Audit**, and **Edit**, targeting the specific lot. Selling a selected quantity retains the existing per-lot preview, cost-basis allocation, and commit rules.

### FREIGHT

Required columns, in order:

| Freight Lot / Description | Tons | Destination | Rate / ton | Total Revenue | Due / Delivery Date | Status | Actions |
| :--- | ---: | :--- | ---: | ---: | :--- | :--- | :--- |
| Freight lot identity and description | Contract tons | Delivery destination | Contract rate (Cr/ton) | Contract revenue (Cr) | Due/delivery date, if applicable | Explicit contract state | Accept, Audit/View, Edit as appropriate |

- Clearly separate freight from owned speculative cargo in both presentation and row identity. Freight contracts do not appear as speculative cargo sale lots.
- Show **Due / Delivery Date** when applicable; distinguish a due date from a recorded delivery date and do not invent a deadline when none applies.
- **Status** clearly identifies the contract's current acceptance, delivery, and payout state.
- **Actions** allows **Accept** for eligible unaccepted freight, **Audit/View** for the row's calculation and contract details, and **Edit** where appropriate to the contract state. Acceptance and edits retain the existing capacity, obligation, history, and commit rules.
- **Total Revenue** presents the contractual revenue; displaying it does not credit the bank. Delivery and payout remain explicit committed actions under the existing freight/mail requirements.

## Markets and speculative trade

- Simulate full commodity availability and purchase/sale pricing using verified Core Rulebook tables, DMs, dice rolls, and price percentages.
- Allow manual overrides of rolls and resulting availability, quantities, and prices. Preserve the generated value, override, and effective value so a referee decision stays visible.
- Provide a per-commodity DM audit screen for availability and buy/sell calculations. Show contributing world trade codes, trader/broker inputs, each applicable DM and source, dice results, total DM, table lookup, base price, effective price, overrides, and fees. Do not hide the RAW result behind an adjustment.
- Support local brokers, their applicable skill/DM effects, and fees. Show fees in previews and account for them explicitly in committed transactions.
- Support illegal goods fully, with clear illegal-goods markings in offers, audits, cargo, and transactions. Apply verified rules and allow referee overrides.
- Market searches create dated world-specific snapshots. Support repeat searches and retain search history, original inputs, effective UWP/trade codes, rolls, DMs, offers, and overrides.
- Old offers remain actionable by default. Each individual offer has an **Expired** checkbox and an optional expiration/date note; unchecked means Active. Expiring one offer disables that offer's purchase action without expiring other offers in the snapshot. Unchecking it restores eligibility, subject to normal validation.
- A snapshot may offer an optional **Expire all offers** convenience action that updates its individual offers. Any snapshot summary status is derived from those offers, not a separate conflicting expiration flag. Time passage or another search does not invent automatic expiration. Expiration changes are recorded in history and support undo.
- Preserve snapshot calculations rather than silently recalculating historical offers when current trader or world inputs change. Purchases remain subject to actual-world, remaining quantity, bank, and cargo checks.

## Commit workflow, cargo, and accounts

- Preview purchases and sales before explicit buy/sell commit actions. Browsing, calculating, or searching does not change the bank or cargo.
- A committed purchase records its cost and fees, updates the bank, reduces available offer quantity, and creates a cargo lot. Validate affordability, tonnage, and cargo capacity.
- Keep separate cargo lots even when they share a commodity. Each lot retains quantity, description, acquisition world/date, purchase price/cost basis, fees, source snapshot, and calculation audit.
- Sell selected lots or quantities without losing their individual cost bases or descriptions. Record proceeds, fees, realized RAW profit/loss, adjusted profit/loss, and remaining cargo.
- Maintain a bank/cargo ledger linking every purchase, sale, fee, delivery payout, and manual expense to its date and source action. Bank and cargo updates must succeed together.
- Allow manual port and operating expenses with an amount, date, and description; debit the bank and retain a ledger/history entry. Full automated ship economics is deferred.

## Rounding and cost basis

Round each new final posted monetary amount up to whole Credits once, or up to Cr100 when that mode is enabled (user clarification 2026-10-04). Preserve unrounded intermediate prices, percentages, and fee calculations for audit; do not repeatedly round intermediate calculations. Calculate realized profit from the posted sale proceeds, posted selling fees, and allocated recorded cost basis. Round positive adjusted profit up using the selected Credit increment. Zero and losses pass through unchanged by the profit setting.

New tonnage entries round up to whole tons as a campaign house rule. The rounding button always uses whole tons, never hundreds of tons. Preserve exact historical quantities and proportional accounting internally; updating existing quantities requires the explicit preview below.

Insured purchase value excludes fees and premiums. Insurance premiums are included in actual acquisition cost basis; claims are separate ledger credits and are not sales or subject to tax/profit reduction.

For partial lot sales, allocate the original purchase cost, applicable acquisition fees and insurance premiums proportionally to the quantity sold. Round the allocated basis down to whole Credits and retain the allocation remainder on the remaining lot. Its final sale consumes the entire remaining recorded basis, reconciling the full original cost without lost or duplicated Credits. Each lot keeps its own basis.

## Profit modes

Offer campaign settings **RAW = 100%**, **Reduced = 75%**, and **Custom = user-defined percentage**.

Preserve RAW purchase/sale percentage tables and calculations. Apply the setting **separately to the quantity sold from each cargo lot**, after allocating its recorded purchase cost (including acquisition fees), subtracting selling fees, and deducting any optional tax. Combine multiple sale lines from the same lot within one commit before applying the percentage; do not net profits and losses across different lots first.

```text
rawProfit = grossSaleProceeds - sellingFees - allocatedCostBasis
profitAfterTax = rawProfit - allocatedTax // zero tax when taxation is disabled
adjustedProfit = profitAfterTax > 0
    ? floor(profitAfterTax * selectedPercentage / 100)
    : profitAfterTax
profitAdjustment = adjustedProfit - profitAfterTax
bankIncreaseOnSale = grossSaleProceeds - sellingFees - allocatedTax + profitAdjustment
```

Purchase costs have already been debited at acquisition: cost basis measures profit and must not be debited again on sale. Calculate broker fees using the verified RAW fee basis before the house-rule adjustment; the adjustment does not rewrite the fee or price tables. Allocate any shared selling fee proportionally by each lot's gross sale proceeds (by quantity if all proceeds are zero), with a stable remainder allocation that preserves the total charged fee. Record each lot's share. Manual port/operating expenses remain separate ledger expenses and are not retrospectively allocated to cargo profit.

The profit-mode adjustment leaves after-tax losses and zero unchanged; tax itself may create or deepen a loss. With taxes disabled: A RAW Cr10,000 profit becomes Cr7,500 in Reduced mode; a RAW Cr10,000 loss remains a Cr10,000 loss. For two lots earning Cr100 and losing Cr100, the adjusted results are Cr75 and minus Cr100, totaling a Cr25 loss. A RAW Cr101 profit becomes Cr76 after upward whole-Credit rounding (or Cr100 in Cr100 mode).

Freight and mail payments are outside this speculative-trade house rule and receive their verified contractual payout without a profit-mode reduction.

Display RAW pre-tax profit, any tax and after-tax profit, and adjusted results separately per sold lot and in transaction totals. Preserve the percentage used on each committed sale and its explicit adjustment ledger entry; later setting changes do not rewrite prior transactions. Custom percentages must be finite and within 0–100 inclusive.

## Optional insurance and taxation

Include independent, off-by-default insurance and tax settings as specified in [OPTIONAL_RULES.md](OPTIONAL_RULES.md). Identify these as first-edition Merchant Prince adaptations in Rules & Notes. INT-007 through INT-021 record approved behavior; verify source data and raise any newly discovered ambiguity before implementing its dependent behavior.

Insurance previews coverage and premiums, links policies to cargo lots, and requires explicit referee-approved claims. Taxes use normal market value to determine taxable profit, shown separately from actual cost-based profit; post tax before applying the positive-profit percentage. Preserve policies, taxes, settings and decision revisions in ledger history, persistence, export/import and undo.

## Freight and mail

- Include freight and mail; exclude passengers.
- Automate freight wherever the Core Rulebook provides enough information: availability, relevant DMs, rolls, tonnage offered, payment due, acceptance, capacity reservation, destination obligation, delivery status, and payout on delivery.
- Permit manual roll overrides and retain the same calculation audit standard used for commodities.
- Track accepted freight/mail contracts independently from owned speculative cargo, including origin, destination, dates, space reservation where applicable, payment terms, and delivery/payout status.
- Delivery and payout require an explicit committed action at the proper actual location; browsing the destination cannot deliver a contract or pay it twice.
- Implement mail eligibility, availability, payment, and delivery from verified rules, with visible inputs and referee overrides.

## Persistence and recovery

Persist campaign state in the browser using localStorage. Provide JSON export/import covering ship/trader state, bank/cargo ledger, cargo lots, contracts, date, route, market snapshots, overrides, settings, and undo/history.

Provide undo and an inspectable action history for committed state changes, including transactions and jumps. Undo must restore dependent bank, cargo, contract, date, location, and offer state consistently. Validate imported data before replacing the campaign and handle unsupported formats or storage failures visibly.

Before an import replaces the campaign or a reset clears it, offer a JSON backup and show an explicit confirmation describing what will change. Canceling leaves the campaign intact. Import validation must finish successfully before replacement; a backup/export failure must be visible and must not silently proceed as if a backup succeeded.

Prevent concurrent browser tabs from silently overwriting campaign state. Allow only one tab to write at a time; other tabs show that the campaign is open elsewhere and may view the latest saved state. Switching the editing tab must reload the latest revision and invalidate stale previews before further commits. Apply the same protection to transactions, edits, import, reset, and undo.

## V1 acceptance checks for implementation

1. Clicking worlds and previous/next browsing leave ship location, date, bank, cargo, and contract delivery state unchanged; COMMIT JUMP changes only the intended committed travel state.
2. UWP overrides feed local trade-code derivation and new calculations; historical snapshot inputs remain preserved.
3. Generated and overridden commodity results are explainable through the per-commodity DM audit.
4. Two lots of the same commodity at different prices/descriptions survive purchases, partial sales, reload, and export/import independently.
5. Repeated market searches retain earlier offers. Expiring one offer leaves others active; optional bulk expiration, reactivation, and undo preserve individual offer state.
6. Buy/sell commits and undo reconcile bank, fees, offer quantities, cargo, and both profit results, including positive, zero, and loss cases.
7. Freight/mail reserve appropriate capacity, retain obligations, and pay once on committed delivery.
8. Illegal goods, manual expenses, campaign dates, persistence, and recovery are exercised before V1 release.
9. Fewest-jumps routes honor mandatory stop order, jump limits, and fuel availability; ties are reproducible and failed connections are explicit.
10. Decimal cargo quantities survive partial sales, reservations, reload, and export/import without whole-ton truncation.
11. Mixed profitable/loss-making lots use per-lot adjustment; Cr101 becomes Cr75 in Reduced mode; costs/fees are counted once, and freight/mail payouts are unchanged.
12. The rules dataset, source references, and worked examples are independently verified and checked into GitHub before trading-engine implementation.

13. With at least 15 cargo lots and 15 market offers, all rows and controls remain reachable on desktop and small screens; headings, counts, filters, sorting, and selected-lot previews behave as specified.

14. Opening bank/cargo setup supports an existing campaign without charging again for already-owned cargo.
15. Referee adjustments require a reason, preserve history, reconcile cost basis, and undo consistently.
16. Import/reset offers a backup and explicit confirmation; cancel or failed validation preserves current data.
17. Two tabs attempting edits cannot overwrite each other's changes; the new editing tab reloads current state before accepting a commit.

18. Rules & Notes shows accurate copyright/credits, rules sources, actual verification status and all agreed interpretation decisions, including the optional first-edition adaptations. Affected audits link to their notes, and historical snapshots retain their interpretation revisions.

19. Optional insurance and taxation start disabled, preserve their own audits and history, follow INT-007 through INT-021, and pass the source, accounting and lifecycle checks in OPTIONAL_RULES.md before release.

20. Purchase offers, cargo sale, and freight use the exact table columns and alignment specified above; headers stay aligned with rows, action widths remain consistent, and every row exposes its modifier audit. Expired offers remain readable and auditable with Buy disabled; same-commodity cargo lots retain separate descriptions and cost bases; freight stays separate from speculative cargo.

## Navigation selection refinement — 2026-10-03

Use searchable sector, subsector and world dropdowns in Find World, setup, route destinations and optional stops. Derive the hex from the chosen world. Route origin is the actual ship world and is displayed clearly. Default nearby choices to the current sector/subsector, show hexes beside world names, and provide the ten most recent selections as a browser shortcut. Changing a parent choice must invalidate its old descendants. Browse and route planning never commit travel.

Provide a numbered local-map hex grid, enabled initially, with a show/hide control. Hex labels are local to each sector; world clicks remain available through the overlay.

## Map and time refinement — 2026-10-03

Show one sector entry per name, using the fixed 1105 map era. The campaign clock is separate: default start 001-1105; elapsed searches, jumps and manual time corrections advance its Imperial date (24-hour days, 365-day years). Later campaign years do not select a different map era. Preserve old custom date labels visibly until the owner converts them.

Offer scroll-wheel map zoom plus accessible +, − and reset controls, with a closer default view and fewer empty hexes. Zoom and browsing do not mutate campaign state. Provide Use as starting world from Find World and the browsed-world panel, with explicit confirmation, a recorded reason, undo, and no implied jump/time/payment. Clear the old route and require amendments for active insurance after such a location correction.


## Ship expenses — clarification 2026-10-04

Provide a **Ship expenses** shortcut in the main navigation and in Accounts. The form uses the ship's actual location, even while browsing another world. Show a live itemized estimate, then an explicit payment confirmation with bank before/after.

- **Berthing:** use the effective starport class. Weekly rates are 1D × Cr1000 (A), × Cr500 (B), × Cr100 (C), × Cr10 (D), and zero (E/X). Explicitly roll and save the rate once per starport; retain it across visits, reloads and backups. Enter whole weeks to pay. A changed effective starport class needs a matching saved rate. Reference: Core Rulebook Update 2022, pp. 257–258.
- **Fuel:** enter decimal tons and choose refined (Cr500/ton) or unrefined (Cr100/ton). Identify listed supply: A/B refined, C/D unrefined, E/X none. Purchasing outside that listed supply requires confirmation of another supplier/referee availability and a note. This records expenditure, not fuel-tank inventory. Reference: Core Rulebook Update 2022, pp. 154, 257–258.
- **Crew salaries:** enter the total monthly cost and whole months to pay. Remember the monthly amount after payment. Do not auto-charge when time advances. Running-cost reference: Core Rulebook Update 2022, pp. 153–154.
- **Staterooms:** include a non-negative whole-number count in initial ship setup and Ship, trader & options. Existing saves without a count remain valid and show zero until configured. Calculate Cr1,000 per stateroom per month, including empty staterooms, as confirmed by the user.
- **Passenger and crew life support:** enter separate passenger and crew headcounts at low, middle and high levels. Monthly rates per person supplied by the user are Cr100 low, Cr1,000 middle and Cr3,000 high. Purchase refills by whole weeks or months; use and disclose a four-week billing month (weekly rates Cr25, Cr250 and Cr750). Stateroom expenses also offer weekly or monthly payment. Headcounts are entered in ship setup/settings and reused for expenses. Luggage is tracked separately as described below; remaining life-support supply inventory is not tracked. Audit these rates as campaign-agreed inputs rather than claiming an unverified rulebook source.
- **Combined payment:** use individual expense checkboxes plus Select all expenses, with independent billing periods and an itemized combined total. Validate all selected entries and total affordability before charging anything. One confirmation creates separate expense ledger entries with a shared payment identifier; one undo reverses the whole payment. Deselecting an expense excludes its fields from validation and payment. Rolling the saved berthing rate must preserve other entered fields.
- Numeric controls have visible increment/decrement arrows. Include optional notes for the billing period or supplier. Prevent negative amounts, invalid periods and unaffordable payments.
- Post each payment once as a separate operating-expense ledger entry, without changing cargo cost basis or campaign time. Preserve the calculation, location, rate/roll, periods or tons, notes and rule footnotes in a readable audit. Canceling a payment changes no bank balance. Undo restores the bank and related saved defaults.


## Map panning and area loading — 2026-10-04

The map supports mouse drag and touch drag. Movement beyond a small threshold pans the map without selecting the world under the pointer. A normal click still browses that world. Reset view restores centered 100% zoom; Current ship centers the ship. Neither browsing nor panning moves the ship or changes campaign time, bank or cargo.

The old 12-parsec display boundary is removed. After panning/zooming pauses, fetch small overlapping areas around the viewport using 12-parsec requests. Debounce requests, allow at most two concurrently, discard obsolete queued requests, and reuse a bounded 32-area memory cache. Map browsing data remains separate from saved campaign and route-planning data. Route search keeps its existing 12-parsec area around each requested stop.

Render nearby visible worlds only, capped at 1,500 markers. Keep planet names visible at every zoom, scaling their font and fitting long names to hex width. Hide hex numbers below 80% zoom and the grid below 48% zoom. Show loading/failure status and allow Refresh nearby to retry. This bounds rendering and requests rather than fetching a single enormous map.


## Planet information window — 2026-10-04

Provide a Planet information button beside the viewed world's controls. Open a read-only, scrollable window showing Traveller Map M1105 data: sector/hex, subsector, allegiance, travel zone, population, decoded UWP, stars, gas giants, planetoid belts, other/total worlds, bases, nobility and resource units. Decode remarks and offer expandable importance, economics and culture details. Keep unknown data explicitly unknown; do not mistake absent counts for zero.

Show available map data immediately, refresh it from Traveller Map, and offer Retry on failure. Cache successful details for the session with a bounded 32-world cache. Ignore responses arriving after the window closes or another dialog opens. Viewing information must not change the campaign, ship location, bank, cargo or time. Distinguish published data from campaign overrides. Include a link to the official world sheet. Decoder tables are adapted from Traveller Map's Apache-2.0 source; attribution and license accompany the tables.


## Ship accommodation, actual occupants and adjustments — 2026-10-04

- Ship setup and Ship, trader & options contain total staterooms (including crew rooms), installed low berths, and separate actual low/middle/high passenger and crew headcounts. Define low as cryogenic, middle as standard service and high as premium service. Headcounts do not represent empty berths. All staterooms retain the agreed Cr1,000/month cost; cabin sharing/allocation remains referee-managed.
- Life-support refills read these actual headcounts. Paying for support cannot board passengers, change their booked class, or change cargo reservations. Preserve existing refill defaults as a starting suggestion for older campaigns, but do not silently treat them as a luggage manifest until setup is saved.
- Show the normal passenger luggage allowance, and offer Use actual total passenger luggage with an editable decimal total in tons, including zero. With no override, allowance follows actual passenger counts. An override replaces the whole allowance and persists visibly until cleared. Extra luggage is allowed only within remaining hold capacity.
- Default luggage accounting uses 0.01 t low, 0.1 t middle and 1 t high per passenger. Reference: Traveller SRD, Spacecraft Operations / Passage (https://www.traveller-srd.com/core-rules/spacecraft-operations/), which describes 10 kg, 100 kg and 1 ton allowances. Treat the decimal cargo-ton mapping as the calculator's accounting convention, not a ship-design mass-to-displacement rule. Crew baggage is not automatically added.
- Passenger luggage contributes to cargo-used totals, buying and freight capacity checks, import validation and available hold space. Display the reservation and remaining space in Cargo. Saving an impossible load must fail without changing the campaign. Editing or undoing passenger settings recalculates available space without charging the bank.
- Each passenger and crew group can select its provided low/middle/high service independently of its booked class, or select Custom and enter non-negative whole Credits per person per month. Custom replaces that group's base rate; it is not a surcharge. Default service follows the group's class. Weekly refills cost one quarter of the resulting monthly total, rounded up to the selected Credit increment only at the final charge.
- Preserve service choices, custom rates, luggage override and headcounts across reload/export/import and undo. Expense previews and readable audits show group counts, provided service, applied per-person monthly rate, purchased period and final charge. Standard cost references remain campaign-agreed inputs; do not present custom settings as published rules.


## Upward rounding and existing-value preview — 2026-10-04

- New Credit entries and final charges round up to whole Credits by default. Ship settings offers whole-Credit or Cr100 increments. New tonnage fields have whole-ton arrows and round upward, e.g. 0.01 → 1 and 1.2 → 2. Zero stays zero. Counts, dice, DMs, identifiers, dates and percentages are not rounded to hundreds.
- Provide **Round up Credits to 100 & tons to whole** in Settings. Show every proposed before/after change before confirmation. It rounds current bank, ship cargo capacity, actual/combined luggage reservation, cargo quantities and values, offer remaining quantities and unit prices, accepted-contract quantities/payments, saved monthly costs and custom service rates. It enables Cr100 rounding for future entries and charges. Reject a rounded load exceeding capacity without changing the campaign; do not silently add capacity beyond its own upward rounding.
- Preserve original ledger transactions, original offer audits and insurance contract terms/claims. Record any bank rounding as its own balancing ledger adjustment. Record the complete current-value change list as readable history. One undo restores current balances, quantities, settings, defaults and related rounding records.
- The normal luggage allowance still derives from 10 kg low, 100 kg middle and 1 ton high; round the combined reservation upward once when new ship settings are saved or bulk rounding is applied. Do not round each small allowance separately. An explicit zero luggage override remains zero. Existing campaigns are not rewritten merely by opening the calculator.
- [R] **Rounding applied** footnotes identify the active Credit increment and whole-ton rule. Input changes and bulk previews show original and rounded values; saved history retains those pairs. Price and expense audits retain their unrounded calculation alongside the final charge. This is a campaign house rule, not a claim about published rounding rules.
- Keep exact intermediate arithmetic and proportional cost-basis/insurance allocation so partial sales and write-offs reconcile. Historical fractional insured quantities can still be claimed without expanding their insured entitlement. Do not round source data or rewrite previously recorded transactions.
