# Traveller Trade Route Calculator — V1 Requirements

[Rules verification status and evidence](RULES_VERIFICATION.md)

Status: agreed V1 product scope. Rules-data preparation is authorized. The owner has also authorized implementation after the open rules questions and verification gate are resolved; seek clarification when new ambiguities arise.

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

The future app must include a visible **Rules verification** link to this project's public GitHub verification record. The record must state whether verification is pending or complete; linking to it must not imply that unverified rules have passed review. Keep this link available from the per-commodity DM audit view as well.

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

Round each final posted monetary amount down to whole Credits once. Preserve unrounded intermediate prices, percentages, and fee calculations for audit; do not repeatedly round intermediate calculations. Calculate realized profit from the posted sale proceeds, posted selling fees, and allocated recorded cost basis. Round positive adjusted profit down to whole Credits. Zero and losses pass through unchanged by the profit setting.

Cargo quantities use decimal tons and preserve the accepted input/rule-result precision, including fractional quantities in manual overrides and partial sales. Do not apply monetary rounding to cargo, reservations, capacity, or remaining quantities. Apply quantity rounding only where an independently verified rule expressly requires it; use exact decimal arithmetic for quantity accounting.

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

The profit-mode adjustment leaves after-tax losses and zero unchanged; tax itself may create or deepen a loss. With taxes disabled: A RAW Cr10,000 profit becomes Cr7,500 in Reduced mode; a RAW Cr10,000 loss remains a Cr10,000 loss. For two lots earning Cr100 and losing Cr100, the adjusted results are Cr75 and minus Cr100, totaling a Cr25 loss. A RAW Cr101 profit becomes Cr75 after rounding down.

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
