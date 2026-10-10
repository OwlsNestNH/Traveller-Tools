# Traveller Ship Operations — Architecture Plan

[Rules verification status and evidence](RULES_VERIFICATION.md)

Status: implemented static application 0.1.0. See RULES_VERIFICATION.md for completed checks and remaining playtest scope.

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

## Module responsibilities

- **World/API adapter:** world identifiers, coordinates, UWP and navigation data, response normalization, request errors.
- **UWP/rules data:** parsing, validation, local trade-code derivation, verified commodity tables and rule references.
- **Route/map:** clickable local map; automatic Fewest jumps between ordered mandatory stops; prefer longer legs first when jump counts tie, then stable world IDs; enforce the ship's jump rating from Settings and show nonblocking fuel-availability warnings under the approved campaign override. Shorter legs remain allowed for connectivity, the destination, and manually required stops. Selected view world and actual ship position remain separate.
- **Trade engine:** availability/pricing, explicit dice inputs, overrides, brokers/fees, per-commodity audit output, RAW/adjusted profit.
- **Contracts:** freight/mail availability, acceptance, capacity reservation, destination obligations, delivery, and payout.
- **Campaign store/actions:** actual ship location, date, trader/ship state, bank/cargo ledger, cargo lots, snapshots, settings, action history, and undo.
- **Persistence:** versioned localStorage state and validated JSON import/export.
- **UI:** ship-computer views, clear previews, audit screens, and explicit buy/sell, delivery, expense, and COMMIT JUMP controls.

Implemented native modules require no build step:

| File | Responsibility |
| --- | --- |
| js/amounts.mjs | Exact rational quantities/money and deterministic allocation |
| js/rules.mjs | Pure rule calculations, prices, market, freight/mail, insurance and tax |
| js/map.mjs | Public API normalization, coordinates, fuel checks and bounded route search |
| js/state.mjs | Validated campaign transitions, accounting and inverse-change undo |
| js/campaign-controller.mjs | Synchronous write orchestration with caller-supplied revisions; distinct transition, prepared jump, Undo, mulligan and replacement paths |
| js/persistence.mjs | localStorage, Web Locks, revisions, backups/import and recovery |
| js/display.mjs | Explicit plain-text Credit formatting and HTML escaping |
| js/form-values.mjs | Exact entry normalization and ordered rounding annotations |
| js/app.mjs | Views, forms, previews, explicit actions and Rules & Notes |
| rules/decisions.json | Bundled approved interpretation register |

Route searches load an area up to 12 parsecs around each requested stop, with a 1600-world cap; an unconnected bounded search fails explicitly. The displayed date is an Imperial calendar date and hour, derived from the campaign starting date and elapsed hours (24-hour days, 365-day years). Freight prices use direct endpoint distance, while insurance uses the agreed planned-route distance. Contract deadlines remain referee-entered; the UI's editable suggested deadline is not a source rule.

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
| Setup/adjustment entry | Opening balance or referee correction, reason, effective date/world, before/after values, affected lot IDs, basis changes |
| History | Committed action, affected entity IDs, prior/resulting state sufficient for consistent undo |

Snapshots preserve original calculation context. A new UWP override or search creates new effective calculation inputs; it does not rewrite a saved offer. Store expiration on each offer; optional bulk expiration updates those flags in one undoable action. Reactivation never resets sold quantities. Reserve capacity for accepted contracts separately from owned cargo and derive available capacity from both.

## Calculation and commit flow

Keep calculation functions separate from state mutations. Supply rolls as explicit values, generate them at the action boundary, and preserve them in audit records. Overrides retain generated and effective values.

A preview computes availability, prices, fees, and RAW/adjusted results without changing economic state. Commit actions revalidate actual world, offer status/remaining quantity, capacity, bank, and selected cargo/contract state; then update all affected entities as one campaign transition and persist it. Prevent duplicate commit/payout application.

Browsing previous/next worlds changes view state only. COMMIT JUMP validates the intended route leg and changes actual location/date/progress together. A delivery action validates actual destination independently of the browsed world.

Use the accounting formulas in [REQUIREMENTS.md](REQUIREMENTS.md#profit-modes). Calculate profit independently for each sold lot after its allocated acquisition cost/fees and selling fees; group lines from the same lot within one commit. Deduct any optional allocated tax first, then adjust only positive remaining speculative-trade profit, round the adjusted value up using the selected Credit increment (whole Credits or Cr100), and record the adjustment explicitly. Sum those per-lot results for the commit; freight/mail payouts and manual operating expenses stay outside the house rule. Preserve the applied percentage and reject invalid custom percentages outside 0–100.

Post each new final monetary amount rounded up once to whole Credits, or to Cr100 when that mode is enabled, while retaining precise intermediate calculations for audit. Preserve previously recorded amounts and their saved rounding increments. Compute profit from recorded cash amounts and cost basis; never debit historical acquisition cost again on sale. Allocate acquisition costs proportionally, rounding the allocated basis down to whole Credits and retaining remainders on the remaining lot; the final sale consumes the entire remaining basis. This allocation rule is separate from upward rounding of new final amounts. Shared selling-fee allocation must preserve the total fee and use deterministic remainder handling. Broker fees use their verified RAW basis before the profit adjustment.

Preserve fractional tons with exact decimal arithmetic (for example, decimal strings with integer arithmetic at the required scale). Do not use whole-ton truncation or floating-point approximations for cargo/capacity accounting. Persist/export the same precision. Explicit rule-mandated quantity rounding belongs in the verified rules layer, separate from monetary rounding.

## Campaign setup and adjustments

Opening balances/lots establish current state without replaying historical purchases or charging for already-owned cargo. Represent setup and referee corrections as explicit actions in the same ledger/history system. Require a reason for corrections and retain before/after bank, quantity, and cost-basis values. Quantity losses write off an explicitly previewed basis amount rather than becoming zero-price sales. Corrections must preserve historical transaction audits and be reversible consistently.

## Persistence, import, and undo

Use a namespaced localStorage key to avoid collisions with other tools. Store a schema version, stable entity IDs, snapshots, ledger, settings, and undo/history. Handle corrupt data, quota/storage errors, and unsupported versions visibly.

Offer a downloadable JSON backup before confirmed import replacement or reset. Cancel and validation/export failure must preserve current state unless the user explicitly elects to proceed without the failed backup. Reset/import must be coordinated with the same writer control as all other mutations.

Use single-writer coordination across same-origin tabs, with an exclusive browser lock where supported and a clearly enforced read-only secondary-tab state. A bare localStorage read-then-write revision check is not an atomic lock and is insufficient by itself. Track a monotonically increasing revision, notify tabs of changes, and reload the latest saved state before allowing a different tab to write. Fail visibly rather than offering unsafe concurrent edits when coordination is unavailable. Revalidate any stale preview against the current revision before committing.

Export the complete campaign as JSON. Parse and validate schema, types, ranges, references, and accounting/capacity consistency before applying an import. Failed validation must leave the current campaign intact.

Represent committed changes as reversible actions or equivalent prior-state records. Undo restores all dependent state together, including bank, cargo, offer quantities, location/date, contract reservations, and delivery/payout status. Preserve an inspectable history rather than silently discarding the accounting trail.

The future UI and commodity audit view expose a **Rules verification** link to the public GitHub record. Verification evidence must identify the applicable rules-data version/commit so users can distinguish evidence for the running version from later updates. No PDF access or private account is required to view the record.

## Rules verification gate

The intended baseline is Traveller Core Rulebook Update 2022; confirm the source's exact edition/update and applicable errata before marking data verified. The source/data gate for version 0.1.0 is complete as recorded in RULES_VERIFICATION.md; initial runtime tests are recorded there. Before implementing the trading engine, check in:

- A versioned structured rules dataset for trade codes, availability/tonnage, pricing, DM combinations, brokers/fees, illegal goods, freight/mail, and travel/date rules.
- Source documentation giving edition/page or table provenance, explicit unresolved items, and a clear distinction between RAW rules and app/house-rule policies.
- Worked input/output examples sufficient to independently check the data and calculations, including boundary cases.

These preparation deliverables are now present under rules/ and verification/. Source/data verification is distinct from later application tests. Do not import the existing spec-trade data as authoritative, bundle PDFs, or add personal source links. Store the rules-data version in snapshots so subsequent data corrections cannot silently change historical transactions.

## Verification before release

Verify rules/data independently against the Core Rulebook and record edition/page provenance. Use worked examples for availability, price DMs, broker fees, illegal goods, freight/mail, and travel dates. Test per-lot profit modes for gains, zero, and losses in the same commit; monetary rounding boundaries; fractional partial sales; cost-basis and shared-fee remainders; unchanged freight/mail payouts; atomic commits/undo; browse versus jump; Fewest jumps through mandatory stops; independent offer expiration/reactivation and bulk undo; and JSON round trips.

Smoke-test direct loading from the GitHub Pages subdirectory, map/API failures, reload persistence, and storage/import errors. No app code or application tests are part of the current documentation-only change.

## Rules & Notes content

Maintain a checked-in, versioned interpretation register with stable IDs, source references, the ambiguity, alternatives, owner decision, rationale, decision date, status and affected calculations. Only explicitly resolved entries may supply automatic rule behavior. Keep unresolved questions pending until the owner answers; do not infer approval from an unanswered question.

The small Rules & Notes button opens an accessible panel rendered from bundled content. Include verification status and public evidence links, interpretations, house rules, copyright/license notices, credits and application version. Calculation audit entries deep-link to relevant notes. Preserve the current Rules verification link. Store applied interpretation IDs/revisions alongside the rules-data version in snapshots and committed history so exports and historical audits retain their meaning.

Copyright and attribution text must be checked against the actual applicable notices before release. This panel does not itself establish a license or permission to reproduce source material. No rulebook PDFs or private reference links are included.

## Optional first-edition modules

Implement insurance and taxation as independently enabled modules, disabled by default, following [OPTIONAL_RULES.md](OPTIONAL_RULES.md). Keep their data/provenance separate from the Core Rulebook baseline. Verification of the optional tables and unresolved adaptation decisions is required before implementing those calculations.

Extend campaign settings and versioned exports with both switches. Policies retain covered lot IDs/quantities, destination, frozen route/risk/value inputs, premium, potential payout, status and claim references. Tax audits retain the normal-market-value benchmark separately from actual acquisition basis, government/organisation, taxable amount, bracket/rate, rolls/overrides and allocated posted tax. Preserve all applied rule/decision revisions.

Add premium, tax and approved-claim ledger types. Commits and undo reconcile bank, cargo, policies, claims and taxes together; prevent duplicate claims. Follow the updated profit formulas in REQUIREMENTS.md: preserve pre-tax RAW profit, subtract tax, and apply profit mode only to the positive remainder. Apply INT-010 through INT-021: per-sale net taxable profit, proportional positive-gain allocation, criminal-market exemption, premiums in cost basis and fractional bracket handling. Preserve each decision revision.

## World-picker and hex-grid implementation

`js/world-picker.mjs` provides native selects with labelled search inputs, cascading invalidation, loading/error/retry feedback and request sequencing. `js/map.mjs` loads sector/subsector/world catalogs using the documented public API, caches successful catalog promises in memory, and evicts failed requests for retry. Tab-delimited data supplies world names/hexes; selecting a world still resolves it through the existing normalized world lookup.

A separate versioned localStorage key stores the last ten world choices; it is an optional UI preference, not economic campaign state or part of campaign JSON. Map hexes use the same world-coordinate projection as world markers. The overlay ignores pointer events, and the toggle changes only presentation.

Map presentation supports bounded wheel/button zoom around the viewed world and draws only the twelve-parsec neighborhood grid. All public world/catalog requests explicitly use M1105; the sector list also deduplicates names. The separate calendar module derives the campaign date from existing saved fields without switching map milieu. Explicit starting-world correction uses the normal atomic, undoable campaign transition, clears the route, records a reason and flags active insurance for amendment.


## Reliability boundary for later shared campaigns

The current local mode remains one writer with read-only secondary tabs. `Store` owns lock acquisition, cancellation, revision checks, save and replacement. Repeated takeover requests cannot queue duplicate ownership; yielding cancels pending acquisition and releases a held lock. A failed lock request or rendering callback must leave saves disabled. Taking ownership reloads the latest validated state before allowing edits. This is same-browser coordination, not a cross-device authorization mechanism.

Keep `state.mjs` transitions and `validate` as the campaign boundary, with route/rules calculations outside persistence. Imports validate structure, references and safe undo-operation shapes before any replacement write; failed imports preserve saved bytes. Schema 1, historical audits, existing optional defaults and JSON backups remain compatible. Browser-only map/disclosure preferences and unaccepted contract drafts do not become campaign authority.

Future sharing should preserve this boundary: one authoritative editor, read-only viewers and explicit handoff, with server-enforced ownership and revision conflict checks if a backend is separately approved. Do not use a browser lock or current viewed world as proof of cross-device authority. Any future schema migration needs versioned backup/round-trip and legacy fixture tests before release. No sharing backend, accounts, new storage service or migration is introduced by this cleanup.

## Mail lifecycle and pre-departure cancellation

Schema 1 gains optional Mail lifecycle fields. New `acceptContract` calls write `firstDeparture: null` and link an immutable acceptance audit; missing fields on old contracts remain unknown. `recordMailDeparture` runs against the pre-jump state inside the same transition as movement, fuel, clock, audit and ledger, recording the first committed jump event and never overwriting it on later travel. If an older journey cannot be reconstructed, the first newly observed departure is explicitly marked as having unverified prior history.

`cancelMail` revalidates one accepted Mail contract at the pure state boundary and changes its status to `cancelled`, with cancellation hours/world/revision and proof source. It does not remove the contract or generate a financial entry. Capacity derives only from accepted contracts. Inverse Undo restores the contract and reservation; immutable cancellation events keep the audit trail. The UI uses the ordinary revision-checked modal and writer-owned save boundary; session offers are not revived by cancellation or Undo.

Legacy proof reconciles the revision-bearing action/Undo event stack with retained inverse entries, reverses those entries to the exact contract creation edge, and verifies jump ledger/audit links. It requires consecutive action revisions from acceptance onward and matching reconstructed post-action locations/hours. It never treats elapsed time, current origin, route index, or absence of a marker as proof. Missing/broken/contradictory trails fail closed. Recorded null markers are also checked for contradictory surviving jumps after the linked acceptance. Historical import replacement can reset revisions without recording a boundary; affected legacy histories may therefore remain unverified. Explicit new markers do not depend on that reconstruction. This is local data consistency, not tamper-proof authorization or a sharing backend.

A verified legacy cancellation has its own retained proof audit. If that cancellation is later undone, its matching audit/action/Undo records can explain the otherwise unrecorded import revision seam at that exact boundary. This preserves proven eligibility after Undo without treating unrelated revision gaps as safe. Jump audits from older releases are paired with their action/Undo history even when those releases did not write a jump ledger row; orphan audits remain unverified.


## Mail panel disclosure

The entire Mail panel is a native `details`/`summary` disclosure, initially closed. Its session-only `mailPanelOpen` UI state survives ordinary renders, tab changes and new checks; it is separate from `mailAcceptedDetailsOpen` and never enters campaign JSON, history, Undo or financial state. Captured native toggle events update only the connected disclosure, so delayed events from replaced markup cannot overwrite the current preference.

The summary derives from the current session result and matching draft or saved contract. It shows current referee-edited terms and lifecycle status, with capacity/origin blockers when acceptance is unavailable. Stored dice and audit snapshots are unchanged. The external Check for mail action remains visible while collapsed, and its existing result/error messages remain outside the disclosure. Expanding makes the full roll, read-only Audit and existing guarded actions available.

## Latest Mail check and history-only cancelled contracts

`mail-history.mjs` owns an optional schema-1 `latestMailCheckId` and immutable `supersedesMailCheckId` links on new check audits. It pairs audit/action records and the retained Undo stack before reconstructing a saved latest result. Explicit references use their own suffix, so incomplete older prefixes do not prevent a new valid check. Legacy records without the reference require a consistent complete trail. Reference replacement participates in the normal transaction and inverse Undo; historical events and dice are never rewritten. Superseded labels are derived from the active latest chain, with undone branches shown as historical.

The UI reconstructs display-only saved results, invalidates stale session Mail drafts, and never accepts from History. Standalone checks preserve freight drafts; accepted contracts remain authoritative independently of the latest check. Cancelled Mail is filtered out only at the main table's presentation boundary. A small History archive exposes saved cancelled contracts even when an imported event trail is absent. No contract deletion, payment, cargo mutation or new storage service is introduced by these display changes.

Bank-ledger density changes are scoped to `.bank-ledger` and its inline entry wrapper. Numeric columns and accounting calculations are unchanged; long labels retain wrapping and keyboard-accessible Details controls placed first, before each entry label.


## Pre-GUI presentation seams

`field()` declares normalized units explicitly as its sixth argument (`credits`, `tons`, or `null`). Display labels and field names do not select normalization. The fractional legacy insured-loss form explicitly opts out; other pre-existing numeric fields keep their own input constraints and validation. Unknown unit metadata fails visibly.

`modal()` accepts explicit `retainRounding`, `insurance`, `tax` and `annotateRounding` flags in its sixth argument. Review/confirmation callers retain accumulated entry annotations; the bulk-rounding preview supplies its own annotation. Labels, modal titles and body text never choose these behaviors. Keep the one-modal session guard, revision checks, writer handoff and exact saved action labels unchanged.

`js/map-geometry.mjs` owns the map's logical dimensions. Rendering, world culling, grid extents, SVG/background bounds, overview projection/clipping, visible-area loading and page-wheel scaling derive from it. This preparation retains the baseline 520×320 viewBox, (260,158) projection origin, original half-dimension camera/load center, overscan, CSS sizes, zoom thresholds and browser-only preferences. A later tall-map change must adjust the real logical viewport and verify all layers/load bounds together; changing CSS alone is not a larger geographic view. Route-search bounds are separate and unchanged.

See [GUI_PARITY.md](GUI_PARITY.md) for all existing controls' future homes and the still-unchecked acceptance gate. No GUI relocation or new feature is implemented by preparation.

## Shared display and form-value helpers

`display.mjs` separates raw `formatCreditsText` from `escapeHtml` and the
application's existing null-aware `moneyHtml` compatibility wrapper. Services
retain their distinct whole-part-only grouping through `formatDecimalCreditsText`.
These helpers preserve exact string/BigInt digits, historical formatting and
the callers' existing text-versus-HTML boundaries. They do not validate data,
round prices, or convert Credit values through `Number`. Feature-specific field
builders, facts lists, labels and attributes remain in their feature modules.

`form-values.mjs` normalizes opted-in entries using the existing exact amounts
and rounding modules. Its pure single-value helper retains an exactly matching
legacy fractional remainder. The field adapter skips blank/disabled controls,
preserves unchanged input spelling, and appends annotations to the supplied
array in order. If a later field is invalid, earlier normalized fields and
annotations remain available for correction and retry. The application still
owns modal/Settings note rendering and the annotation lifetime.

This extraction does not authorize transactions, change state validation or
move save completion, modal/session ownership, trade quotes or map/search work.
Campaign schema, storage, calculations, prepared jump rolls, Undo, passenger
accounting and the future one-editor boundary are unchanged.

## Expanded Overview navigation

`mapExpanded` and its restore destination are session-only UI state in `app.mjs`.
The full navigation section becomes a single column, while its map viewport
grows in both dimensions. Existing measured geometry drives SVG bounds, world
projection/culling, grid, overview layers and visible-area requests. The zoom,
pixel pan and selected-world anchor are unchanged, so larger dimensions reveal
more geography without scaling labels, markers or controls.

Unpaid services retain their existing campaign lock until the user explicitly
chooses to discard the draft and expand. That choice uses the existing Back
cleanup, invalidating detached service controls; cancelling changes nothing.
Expense summary and paid receipt destinations may be restored, using the same
ledger receipt ID rather than a new payment. The receipt reload preference is
retained while expanded. Opening another service or main tab exits expansion.
This feature adds no campaign state, schema, storage key or transaction path.

## Contextual rule-reference presentation

`rule-references.mjs` is a versioned, static bibliography and classification
catalogue. It contains no campaign state, dynamic amounts or rule calculations.
`ruleInfo()` emits a non-submitting, read-only control. Existing audit headings
and grouped Settings/service content own placement; no new table columns or
persistent campaign fields are introduced.

`rule-popover.mjs` mounts one independent native dialog above any existing
transaction dialog. It never replaces the host form, submit callback, revision
or rounding annotation state. Capture-phase activation prevents summary toggles
and form submission. Escape closes only the reference; focus returns to the
original button or its logical replacement after a background render. A small
same-gesture guard prevents the tail of a double-click from reaching controls
behind a dismissed popup. Dynamic quote/rounding updates retain reference-button
nodes, preserving pointer and keyboard targets through ordinary input blur.

The catalogue explains current policy. Saved inputs, generated/effective
values, entered reasons, missing evidence and recorded amounts remain in their
existing audits. Historical interpretation records are retained; the Notes
view explains that later upward-charge rounding supersedes INT-021's older
rounding description without rewriting that decision or any transaction.

## Selective world-field correction history

`world-change-history.mjs` owns version-1 optional world-change audits inside
schema-1 campaign events. Snapshots contain only published-UWP context and the
editable override fields, preserving absence separately from explicit values.
UWP differences are named semantic components. New transitions link their audit
to both the action summary and its retained Undo entry. Validation checks exact
summary/revision pairing and replays the new action/Undo suffix, preserving
incomplete legacy prefixes and import revision restamping without granting them
new evidence.

Selective correction checks the linked active action, later same-field changes
and the current field value before changing one live property/component. It
never applies an old whole-world or whole-campaign inverse. The existing
controller/Store owns revision, writer and durable-save boundaries. The new
awaited confirmation declares its own failure-message context while preserving
the established deposit behavior. Original events remain immutable; global
Undo removes the correction's active link but retains its audit.

History presentation hides only the paired duplicate summary, without mutating
the event list. Legacy target-world ambiguity is displayed explicitly. Protected
History Undo is clickable by an editor to obtain a warning, while state-level
jump/mulligan enforcement remains unchanged. The dedicated Jump Undo control
retains its existing unavailable state.

### Read-only Dashboard and fixed baseline (.41)

`dashboard-baseline.mjs` validates an optional schema-1 `dashboardBaseline` with version, origin, bank, dateLabel, hours and excludedLedgerIds. New setup captures its opening entry. A legacy initialized campaign is captured synchronously while acquiring the existing writer lock, before editing/publication; only that metadata is attached to the original parsed JSON. This same-revision initialization preserves legacy action-sequence proofs and jump mulligans. It is outside the corrupt-save catch: an unsuccessful metadata write fails closed without labelling valid saved data corrupt.

Normal saves reject changes/removal of a durable baseline even at the same action revision. Explicit campaign replacement uses the incoming boundary or seeds its current state; reset clears it. Fresh setup after Undo setup may establish a new opening boundary. Transition inverse snapshots exclude the metadata, and Undo retains it. Baseline shape validation is intrinsic: its IDs may have been undone, its hours may exceed a corrected clock, and its bank may be negative.

`dashboard-data.mjs` selects surviving ledger IDs outside that fixed exclusion set. The residual `bank - baseline.bank - sum(selected amounts)` is a visible earlier-history/balance adjustment, never operating income. Ledger order supplies transaction and jump-visit order. `financial-summary.mjs` is the common read-only operating-result calculation for the Dashboard and TXT report. `dashboard-view.mjs` plus `dashboard.css` render dependency-free local SVG with accessible exact-value tables. Reads, navigation, rendering, chart sampling and window sizes never mutate a campaign.

### Stage 2: jump save completion (.42)

`jump()` owns one preparation operation before asking the existing controller
to prepare its roll. A synchronous local result opens the existing confirmation
immediately. Only a completion Promise opens a pending preparation screen; the
Promise is observed before constructing that screen. Repeated activation cannot
start another preparation. A known unsaved failure can retry the same transient
rolled dice within that screen; Cancel/reload still use authoritative saved
state and do not add persistent draft data.

Foreign publication or editing loss invalidates only the owned jump operation
and jump confirmation. Late completion cannot reopen its destination or change
a newer view. Saved or unknown preparation/display failures require reload,
with wording about prepared dice rather than claiming the journey happened.

Final jump confirmation opts into the existing awaited-modal boundary, captures
its explicit revision and elapsed hours, and freezes the hours field with
`readonly` rather than disabling it (so FormData retains the value). It changes
the viewed location only after save completion and while its session is current.
Validation is a known pre-write failure; post-save display cleanup is a committed
publication failure. No controller/state rule, ledger calculation, saved-roll
reuse rule or one-mulligan policy is changed.

`COMPLETION_MIGRATION.md` tracks the remaining Stage 2 callers. Quote/preview
ownership consolidation (Stage 3) remains separate and has not started here.

## Stage 2 Undo completion (.43)

`undoJump` and `undoLatestChange` share only an in-flight UI owner. State Undo,
controller return values, persistence, audits and the one-mulligan barrier are
unchanged. The owner exists before the controller invocation, including a
reentrant publication, and is invalidated by foreign publication or editor loss.
Cleanup and success occur only after completion in the same owned session.
A local pending Undo publication installs campaign state but defers UI mail,
selection and route reconciliation until that completion, including renders
requested by an earlier map refresh. Foreign publication still reconciles
immediately and retires the owner.

Undo Jump uses its existing confirmation with the awaited save contract. Ordinary
History Undo remains immediate for the synchronous Store. A delayed provider gets
a no-submit pending dialog, preventing repeat activation and dismissal. A known
unsaved failure allows Close and a deliberate fresh History retry; saved or
unknown failures require reload. Promise rejection handlers are installed before
pending UI creation. Post-save cleanup failures identify the captured expected
revision; controller Undo still returns the provider's raw completion.

Replacement/import/reset and Stage 3 quote ownership are separate remaining work.


## Stage 2 replacement completion (.44)

The controller's existing write-operation object also supplies an optional
replacement publication token. `takeReplacementPublication` consumes it once
at expected revision + 1, independent of the imported revision. Store forwards
it only as callback metadata in normal and corrupt-recovery branches; it never
enters JSON. Replacement remains false for both local-save classifications and
still invalidates old campaign offers. Raw synchronous/provider completion
values and Store's revision, ownership and Dashboard-baseline rules are retained.

`backupReplace` captures its revision and review session before submission.
Matching publication installs state and invalidates offers immediately, while
completion-specific view/selection reconciliation is deferred. Only the exact
published snapshot and retained campaign/editor/dialog owner may finish cleanup
and show success. Other publication (including same revision) or editing loss
permanently invalidates the review; reacquiring editing cannot revive it.
Known-unsaved failures retain a retryable review. Published or unknown outcomes,
including detached-dialog and post-save-close faults, require reload and checking
which campaign is saved. Reset may empty History, so History alone is not the
recovery instruction.

Each file selection captures a request identity, publication epoch, modal
creation/closure generation and editing-loss epoch. Stale read success and
failure are inert. Validation and the 20 MB limit remain. This is UI completion
ownership, not cancellation of an already accepted provider operation; the
existing recovery replacement deliberately bypasses reading a corrupt revision.
No new provider source/CAS protocol, JSON schema or Stage 3 work is introduced.


## Stage 2 Settings completion (.45)

Settings has a form/draft completion owner; it does not retain a second campaign
or recompute settings at settlement. The existing settings mutator remains
unchanged. A narrow optional `act` announcement option suppresses only the
Settings caller's early/stale banner. An optional controller transition
preparation notification runs after successful transition validation and before
provider save, with no candidate arguments. It lets Settings distinguish input
validation (existing group reveal) from verified storage rejection (preserve
existing disclosures), without duplicating validation or matching error text.
The default transition signature and synchronous/Promise result contract remain.

Inline submission captures revision, draft/form and rounding identities before
saving. Matching one-use local publication installs state and records the exact
expected-revision-plus-one object; UI cleanup waits for completion. Only delayed
saves acquire a non-submit pending modal, with Promise rejection observed before
constructing that screen. Global render/handoff guards are scoped to that actual
operation. Foreign/nonmatching publication, same-revision update or editor loss
permanently retires its UI owner and releases deferral; a submitted stale draft
requires explicit Revert rather than silent rebasing.

Per-form pending locks cover mounted and suspended Settings forms. Settlement
releases only that operation's lock and reapplies current read-only/terminal
restrictions without rewriting newer values, disclosures, focus or view.
Successful cleanup prevents close from reattaching the saved old form. Legacy
modal saving preserves an unrelated dirty inline draft as stale. Saved/unknown
or failed-publication/cleanup/close outcomes latch reload guards before reporting,
including detached or partially constructed pending dialogs. An observed owned
publication outranks a contradictory not-committed provider error. Setup,
location, time/day controls and Stage 3 ownership remain separate work.


## Stage 2 setup/location completion (.46)

Setup and location correction own their modal, submitted fields/rounding,
campaign revision and editor tenure across two phases. Lookup and validation
remain cancellable; entering the controller's existing preparation hook promotes
only that session to non-dismissible save-pending before provider invocation.
Synchronous Store completion remains synchronous once lookup has completed.
The consumed local publication token must identify the exact expected revision
and snapshot. Owned publication installs state while presentation cleanup waits
for completion. Foreign/same-revision publication, editing loss or obsolete
modal intent permanently retires the old owner; later editing cannot revive it.

Known no-write failures preserve correction/retry. Observed publication outranks
a contradictory not-committed error. Missing or wrong publication, unknown
outcome, and post-publication cleanup/close/reporting failures latch reload
protection even after detachment. Completion may not clear newer drafts, steal
newer view/focus, close a newer dialog or announce obsolete success. Find-world
browsing remains available without editing; its starting-world handoff carries
separate campaign/editor intent through picker resolution.

Setup's nearby-world enrichment is guarded ancillary work after the campaign
save; failure must say the campaign was saved and must not reopen its submission.
Location's nearby lookup stays before saving. Same-world refresh creates no
campaign write. The existing setup/location state mutations, opening baseline,
location correction audit, policy amendment and one-mulligan rules are retained.
There is no new persistence schema, provider protocol, accounting engine or
Stage 3 preview ownership change.
