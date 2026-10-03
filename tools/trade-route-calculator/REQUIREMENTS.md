# Traveller Trade Route Calculator — V1 Requirements

Status: locked V1 scope; documentation only. No app implementation is included.

## Authority and scope

This document captures the authoritative product decisions from the design process and project request. Implementation must use the checked-in GitHub documents; it must not require access to that chat or the user's personal references. Implement Traveller rules against the Core Rulebook, with the reduced-profit setting explicitly identified as a house rule.

The existing `tools/spec-trade/` tool is buggy and untrusted. It must not serve as rules authority. Any reused code or data must be independently verified against the Core Rulebook. Record the edition and rule references during implementation; do not invent missing tables or formulas.

V1 is a free-only static web app in this repository. All app code, verified rules data, and supporting documentation must be checked into GitHub. The deployed tool must not access, embed, link to, or require the actual rulebook PDFs, the user's private files/accounts, or the design conversation. Rulebook verification is a development activity; record concise rule provenance in GitHub without bundling PDFs or personal reference links. Passengers and the deferred features in [BACKLOG.md](BACKLOG.md) are excluded.

## Worlds, map, and route

- Use the Traveller Map public API for live world and navigation data.
- Provide a clickable local world map for selecting and inspecting worlds.
- Parse UWP locally and derive trade codes locally from the effective UWP. Allow editable UWP overrides and display the original and effective values clearly.
- Support a start world, end world, and editable intermediate stops. Revalidate the route after edits.
- Route validity considers ship jump capability and fuel availability at relevant stops. V1 does not simulate fuel consumption or maintain a fuel-use ledger.
- Keep the viewed world separate from the ship's actual current world. Previous/next world controls browse the route for inspection and planning; they do not move the ship, advance the date, or deliver contracts.
- Use an explicit **COMMIT JUMP** action to move the ship along a valid leg and record the resulting location, date, and history. Date/jump handling must use verified rules and preserve the applied elapsed time for audit.
- Maintain an editable campaign date and support recording time spent between jumps. A route edit or world preview must not silently advance campaign time.

## Ship-computer interface and state

Use a ship-computer interface with readable world, route, market, cargo, accounts, and history views. Show actual location and browsed location distinctly. Maintain ship, trader, bank balance, cargo capacity/usage, campaign date, route progress, and profit-mode state. Trader and ship inputs must supply the verified rules calculations and route/capacity checks.

## Markets and speculative trade

- Simulate full commodity availability and purchase/sale pricing using verified Core Rulebook tables, DMs, dice rolls, and price percentages.
- Allow manual overrides of rolls and resulting availability, quantities, and prices. Preserve the generated value, override, and effective value so a referee decision stays visible.
- Provide a per-commodity DM audit screen for availability and buy/sell calculations. Show contributing world trade codes, trader/broker inputs, each applicable DM and source, dice results, total DM, table lookup, base price, effective price, overrides, and fees. Do not hide the RAW result behind an adjustment.
- Support local brokers, their applicable skill/DM effects, and fees. Show fees in previews and account for them explicitly in committed transactions.
- Support illegal goods fully, with clear illegal-goods markings in offers, audits, cargo, and transactions. Apply verified rules and allow referee overrides.
- Market searches create dated world-specific snapshots. Support repeat searches and retain search history, original inputs, effective UWP/trade codes, rolls, DMs, offers, and overrides.
- Old offers remain actionable by default. Each saved snapshot has Active/Expired status, an Expired checkbox, and an optional expiration/date note. Marking an offer expired disables its purchase action; time passage or another search does not invent automatic expiration.
- Preserve snapshot calculations rather than silently recalculating historical offers when current trader or world inputs change. Purchases remain subject to actual-world, remaining quantity, bank, and cargo checks.

## Commit workflow, cargo, and accounts

- Preview purchases and sales before explicit buy/sell commit actions. Browsing, calculating, or searching does not change the bank or cargo.
- A committed purchase records its cost and fees, updates the bank, reduces available offer quantity, and creates a cargo lot. Validate affordability, tonnage, and cargo capacity.
- Keep separate cargo lots even when they share a commodity. Each lot retains quantity, description, acquisition world/date, purchase price/cost basis, fees, source snapshot, and calculation audit.
- Sell selected lots or quantities without losing their individual cost bases or descriptions. Record proceeds, fees, realized RAW profit/loss, adjusted profit/loss, and remaining cargo.
- Maintain a bank/cargo ledger linking every purchase, sale, fee, delivery payout, and manual expense to its date and source action. Bank and cargo updates must succeed together.
- Allow manual port and operating expenses with an amount, date, and description; debit the bank and retain a ledger/history entry. Full automated ship economics is deferred.

## Rounding and cost basis

Round calculated quantities and monetary amounts down to the supported unit (whole tons and whole Credits unless a verified rule explicitly defines a different unit). Preserve unrounded intermediate values for calculation audit and round the final applicable result down; do not repeatedly round intermediate calculations. Rounding must not change the requirement that losses remain unchanged by profit mode.

For partial lot sales, allocate the original purchase cost and applicable acquisition fees proportionally to the quantity sold. Track remaining cost basis and retain any allocation remainder on the remaining lot so its final sale reconciles the full original cost without lost or duplicated Credits. Each lot keeps its own basis.

## Profit modes

Offer campaign settings **RAW = 100%**, **Reduced = 75%**, and **Custom = user-defined percentage**.

Preserve RAW purchase/sale percentage tables and calculations. Apply the setting after the RAW transaction result is known:

```text
adjustedProfit = rawProfit > 0 ? rawProfit * selectedPercentage / 100 : rawProfit
```

Losses remain unchanged; zero remains zero. A RAW Cr10,000 profit becomes Cr7,500 in Reduced mode; a RAW Cr10,000 loss remains a Cr10,000 loss. Display RAW and adjusted results separately for every affected transaction. Preserve the percentage used on each committed transaction and reconcile any adjustment with the bank ledger without changing the original RAW calculation.

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

## V1 acceptance checks for implementation

1. Clicking worlds and previous/next browsing leave ship location, date, bank, cargo, and contract delivery state unchanged; COMMIT JUMP changes only the intended committed travel state.
2. UWP overrides feed local trade-code derivation and new calculations; historical snapshot inputs remain preserved.
3. Generated and overridden commodity results are explainable through the per-commodity DM audit.
4. Two lots of the same commodity at different prices/descriptions survive purchases, partial sales, reload, and export/import independently.
5. Repeated market searches retain earlier offers; only explicit expiration disables an otherwise valid historical offer.
6. Buy/sell commits and undo reconcile bank, fees, offer quantities, cargo, and both profit results, including positive, zero, and loss cases.
7. Freight/mail reserve appropriate capacity, retain obligations, and pay once on committed delivery.
8. Illegal goods, manual expenses, campaign dates, persistence, and recovery are exercised before V1 release.
