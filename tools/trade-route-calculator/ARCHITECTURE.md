# Traveller Trade Route Calculator — Architecture Plan

[Rules verification status and evidence](RULES_VERIFICATION.md)

Status: proposed implementation structure for the locked V1 requirements. This folder currently contains planning documents only.

## Free-only static stack

| Concern | Choice |
| --- | --- |
| Interface | HTML, CSS, vanilla JavaScript; ship-computer presentation |
| World/navigation source | Traveller Map public API |
| Rules and calculations | Local JavaScript with independently verified Core Rulebook data |
| Browser persistence | localStorage |
| Portable backup/restore | Versioned JSON export/import |
| Source control | GitHub, in OwlsNestNH/Traveller-Tools |
| Static hosting | GitHub Pages |

No paid services, paid API dependencies, server backend, database service, or required accounts for users. No framework or build service is required. Keep deployment compatible with the repository's existing GitHub Pages setup and project subdirectory paths. This documentation commit does not change hosting configuration or publish an implemented app.

## Self-contained GitHub source

All application code, verified structured rules data, and supporting documentation live in this GitHub repository. The runtime reads bundled rules data and Traveller Map public API responses only; it has no access to rulebook PDFs, private Drive files, the user's accounts, or design-chat history. Do not bundle PDFs or add personal reference links. Core Rulebook verification happens during development; record edition/page provenance in checked-in documentation so future maintainers can review the source without a dependency on the original user. The planning documents are the implementation specification. [RULES_VERIFICATION.md](RULES_VERIFICATION.md) is the public status and evidence record; it does not replace the specification or constitute verified rules data.

## Boundaries

Keep the tool isolated under `tools/trade-route-calculator/`. Preserve existing tools and shared repository content. The existing `tools/spec-trade/` tool is buggy/untrusted and is not a rules authority. Any reused code or data must be independently verified against the Core Rulebook before integration.

Traveller Map supplies live world/navigation information, not authoritative commodity prices or trade rules. Normalize API responses at an adapter boundary. Parse UWP and derive trade codes locally from effective world values. Record original API values separately from overrides and report missing data/API errors without silently fabricating results.

Confirm current Traveller Map endpoints and browser access requirements during implementation. Detailed API contracts are intentionally not asserted by these planning documents.

## Proposed modules

- **World/API adapter:** world identifiers, coordinates, UWP and navigation data, response normalization, request errors.
- **UWP/rules data:** parsing, validation, local trade-code derivation, verified commodity tables and rule references.
- **Route/map:** clickable local map; automatic Fewest jumps between ordered mandatory stops; distance then stable-world-ID tie-breaking; route validation using jump capability and fuel availability; separate selected view world and actual ship position.
- **Trade engine:** availability/pricing, explicit dice inputs, overrides, brokers/fees, per-commodity audit output, RAW/adjusted profit.
- **Contracts:** freight/mail availability, acceptance, capacity reservation, destination obligations, delivery, and payout.
- **Campaign store/actions:** actual ship location, date, trader/ship state, bank/cargo ledger, cargo lots, snapshots, settings, action history, and undo.
- **Persistence:** versioned localStorage state and validated JSON import/export.
- **UI:** ship-computer views, clear previews, audit screens, and explicit buy/sell, delivery, expense, and COMMIT JUMP controls.

These are responsibilities, not files created by this task. Native JavaScript modules can provide separation without introducing a required build step.

## Responsive list views

Use bounded, independently scrollable desktop market/cargo regions with sticky table headers and readable row sizes. Target roughly eight market rows and five to six dashboard cargo rows without capping the data. Keep the sale preview outside the cargo scroll region and navigation/jump controls outside market/cargo overflow.

Provide view-only market search and status/legality filters, total/matching counts, and a full searchable/sortable Cargo tab reached through **View all N lots**. Key selection by stable lot/offer ID so sorting/filtering cannot switch transaction targets. Use scrolling, not pagination, for 10–15 entries. At narrow widths, stack panels and remove nested vertical scrolling in favor of page scrolling.

## State model

Use stable IDs and explicit links rather than commodity names as keys.

| Entity | Essential data |
| --- | --- |
| Campaign | Schema version, ship/trader inputs, bank balance, actual world, campaign date, profit setting |
| Route/view | Start/end, ordered mandatory stops, calculated intermediate worlds, Fewest jumps mode, validation/search boundary, committed progress, independently selected browsed world |
| World context | API identity/coordinates, original UWP, effective UWP, override provenance, derived trade codes |
| Market snapshot | World/date/search ID, rules-data version, frozen calculation inputs, rolls, DMs, offers, overrides; any expiration summary derived from offers |
| Market offer | Stable offer ID, snapshot ID, commodity, original/remaining quantity, price/audit, individual Expired flag and optional expiration/date note |
| Cargo lot | Lot ID, commodity/legality, description, quantity, cost basis/fees, purchase world/date, snapshot reference |
| Freight/mail contract | Contract ID, origin/destination, tonnage/reservation, audit, payment terms, status and payout reference |
| Ledger entry | Action ID, date/world, amount/type, linked lot/contract/offer, fees, RAW/adjusted results and applied percentage |
| History | Committed action, affected entity IDs, prior/resulting state sufficient for consistent undo |

Snapshots preserve original calculation context. A new UWP override or search creates new effective calculation inputs; it does not rewrite a saved offer. Store expiration on each offer; optional bulk expiration updates those flags in one undoable action. Reactivation never resets sold quantities. Reserve capacity for accepted contracts separately from owned cargo and derive available capacity from both.

## Calculation and commit flow

Keep calculation functions separate from state mutations. Supply rolls as explicit values, generate them at the action boundary, and preserve them in audit records. Overrides retain generated and effective values.

A preview computes availability, prices, fees, and RAW/adjusted results without changing economic state. Commit actions revalidate actual world, offer status/remaining quantity, capacity, bank, and selected cargo/contract state; then update all affected entities as one campaign transition and persist it. Prevent duplicate commit/payout application.

Browsing previous/next worlds changes view state only. COMMIT JUMP validates the intended route leg and changes actual location/date/progress together. A delivery action validates actual destination independently of the browsed world.

Use the accounting formulas in [REQUIREMENTS.md](REQUIREMENTS.md#profit-modes). Calculate profit independently for each sold lot after its allocated acquisition cost/fees and selling fees; group lines from the same lot within one commit. Adjust only positive speculative-trade profit, round the adjusted value down, and record the adjustment explicitly. Sum those per-lot results for the commit; freight/mail payouts and manual operating expenses stay outside the house rule. Preserve the applied percentage and reject invalid custom percentages outside 0–100.

Post final monetary amounts as whole Credits rounded down once, while retaining precise intermediate calculations for audit. Compute profit from recorded cash amounts and cost basis; never debit historical acquisition cost again on sale. Allocate acquisition costs proportionally, retaining remainders on the remaining lot; fully reconcile the basis at final sale. Shared selling-fee allocation must preserve the total fee and use deterministic remainder handling. Broker fees use their verified RAW basis before the profit adjustment.

Preserve fractional tons with exact decimal arithmetic (for example, decimal strings with integer arithmetic at the required scale). Do not use whole-ton truncation or floating-point approximations for cargo/capacity accounting. Persist/export the same precision. Explicit rule-mandated quantity rounding belongs in the verified rules layer, separate from monetary rounding.

## Persistence, import, and undo

Use a namespaced localStorage key to avoid collisions with other tools. Store a schema version, stable entity IDs, snapshots, ledger, settings, and undo/history. Handle corrupt data, quota/storage errors, and unsupported versions visibly.

Export the complete campaign as JSON. Parse and validate schema, types, ranges, references, and accounting/capacity consistency before applying an import. Failed validation must leave the current campaign intact.

Represent committed changes as reversible actions or equivalent prior-state records. Undo restores all dependent state together, including bank, cargo, offer quantities, location/date, contract reservations, and delivery/payout status. Preserve an inspectable history rather than silently discarding the accounting trail.

The future UI and commodity audit view expose a **Rules verification** link to the public GitHub record. Verification evidence must identify the applicable rules-data version/commit so users can distinguish evidence for the running version from later updates. No PDF access or private account is required to view the record.

## Rules verification gate

The intended baseline is Traveller Core Rulebook Update 2022; confirm the source's exact edition/update and applicable errata before marking data verified. The gate is currently pending. Before implementing the trading engine, check in:

- A versioned structured rules dataset for trade codes, availability/tonnage, pricing, DM combinations, brokers/fees, illegal goods, freight/mail, and travel/date rules.
- Source documentation giving edition/page or table provenance, explicit unresolved items, and a clear distinction between RAW rules and app/house-rule policies.
- Worked input/output examples sufficient to independently check the data and calculations, including boundary cases.

These are future preparation deliverables, not files or verified rules supplied by this documentation change. Do not import the existing spec-trade data as authoritative, bundle PDFs, or add personal source links. Store the rules-data version in snapshots so subsequent data corrections cannot silently change historical transactions.

## Verification before release

Verify rules/data independently against the Core Rulebook and record edition/page provenance. Use worked examples for availability, price DMs, broker fees, illegal goods, freight/mail, and travel dates. Test per-lot profit modes for gains, zero, and losses in the same commit; monetary rounding boundaries; fractional partial sales; cost-basis and shared-fee remainders; unchanged freight/mail payouts; atomic commits/undo; browse versus jump; Fewest jumps through mandatory stops; independent offer expiration/reactivation and bulk undo; and JSON round trips.

Smoke-test direct loading from the GitHub Pages subdirectory, map/API failures, reload persistence, and storage/import errors. No app code or application tests are part of the current documentation-only change.
