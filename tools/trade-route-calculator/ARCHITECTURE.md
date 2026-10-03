# Traveller Trade Route Calculator — Architecture Plan

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

All application code, verified structured rules data, and supporting documentation live in this GitHub repository. The runtime reads bundled rules data and Traveller Map public API responses only; it has no access to rulebook PDFs, private Drive files, the user's accounts, or design-chat history. Do not bundle PDFs or add personal reference links. Core Rulebook verification happens during development; record edition/page provenance in checked-in documentation so future maintainers can review the source without a dependency on the original user. The three planning documents are the implementation specification.

## Boundaries

Keep the tool isolated under `tools/trade-route-calculator/`. Preserve existing tools and shared repository content. The existing `tools/spec-trade/` tool is buggy/untrusted and is not a rules authority. Any reused code or data must be independently verified against the Core Rulebook before integration.

Traveller Map supplies live world/navigation information, not authoritative commodity prices or trade rules. Normalize API responses at an adapter boundary. Parse UWP and derive trade codes locally from effective world values. Record original API values separately from overrides and report missing data/API errors without silently fabricating results.

Confirm current Traveller Map endpoints and browser access requirements during implementation. Detailed API contracts are intentionally not asserted by these planning documents.

## Proposed modules

- **World/API adapter:** world identifiers, coordinates, UWP and navigation data, response normalization, request errors.
- **UWP/rules data:** parsing, validation, local trade-code derivation, verified commodity tables and rule references.
- **Route/map:** clickable local map, start/end/stops, route validation using jump capability and fuel availability, selected view world.
- **Trade engine:** availability/pricing, explicit dice inputs, overrides, brokers/fees, per-commodity audit output, RAW/adjusted profit.
- **Contracts:** freight/mail availability, acceptance, capacity reservation, destination obligations, delivery, and payout.
- **Campaign store/actions:** actual ship location, date, trader/ship state, bank/cargo ledger, cargo lots, snapshots, settings, action history, and undo.
- **Persistence:** versioned localStorage state and validated JSON import/export.
- **UI:** ship-computer views, clear previews, audit screens, and explicit buy/sell, delivery, expense, and COMMIT JUMP controls.

These are responsibilities, not files created by this task. Native JavaScript modules can provide separation without introducing a required build step.

## State model

Use stable IDs and explicit links rather than commodity names as keys.

| Entity | Essential data |
| --- | --- |
| Campaign | Schema version, ship/trader inputs, bank balance, actual world, campaign date, profit setting |
| Route/view | Start/end, ordered stops, committed progress, independently selected browsed world |
| World context | API identity/coordinates, original UWP, effective UWP, override provenance, derived trade codes |
| Market snapshot | World/date/search ID, frozen calculation inputs, rolls, DMs, offers, overrides, Active/Expired state and note |
| Cargo lot | Lot ID, commodity/legality, description, quantity, cost basis/fees, purchase world/date, snapshot reference |
| Freight/mail contract | Contract ID, origin/destination, tonnage/reservation, audit, payment terms, status and payout reference |
| Ledger entry | Action ID, date/world, amount/type, linked lot/contract/offer, fees, RAW/adjusted results and applied percentage |
| History | Committed action, affected entity IDs, prior/resulting state sufficient for consistent undo |

Snapshots preserve original calculation context. A new UWP override or search creates new effective calculation inputs; it does not rewrite a saved offer. Reserve capacity for accepted contracts separately from owned cargo and derive available capacity from both.

## Calculation and commit flow

Keep calculation functions separate from state mutations. Supply rolls as explicit values, generate them at the action boundary, and preserve them in audit records. Overrides retain generated and effective values.

A preview computes availability, prices, fees, and RAW/adjusted results without changing economic state. Commit actions revalidate actual world, offer status/remaining quantity, capacity, bank, and selected cargo/contract state; then update all affected entities as one campaign transition and persist it. Prevent duplicate commit/payout application.

Browsing previous/next worlds changes view state only. COMMIT JUMP validates the intended route leg and changes actual location/date/progress together. A delivery action validates actual destination independently of the browsed world.

For profit settings, preserve RAW rule calculations and apply the percentage only to positive realized profit. Record RAW and adjusted values and an explicit reconciled adjustment in the ledger; never rewrite RAW price tables. Define rounding and allocation for partial sales against verified examples before implementation.

## Persistence, import, and undo

Use a namespaced localStorage key to avoid collisions with other tools. Store a schema version, stable entity IDs, snapshots, ledger, settings, and undo/history. Handle corrupt data, quota/storage errors, and unsupported versions visibly.

Export the complete campaign as JSON. Parse and validate schema, types, ranges, references, and accounting/capacity consistency before applying an import. Failed validation must leave the current campaign intact.

Represent committed changes as reversible actions or equivalent prior-state records. Undo restores all dependent state together, including bank, cargo, offer quantities, location/date, contract reservations, and delivery/payout status. Preserve an inspectable history rather than silently discarding the accounting trail.

## Verification before release

Verify rules/data independently against the Core Rulebook and record edition/page provenance. Use worked examples for availability, price DMs, broker fees, illegal goods, freight/mail, and travel dates. Test profit modes for gains, zero, and losses; partial sales across distinct lots; atomic commits/undo; browse versus jump; expiration; and JSON round trips.

Smoke-test direct loading from the GitHub Pages subdirectory, map/API failures, reload persistence, and storage/import errors. No app code or application tests are part of the current documentation-only change.
