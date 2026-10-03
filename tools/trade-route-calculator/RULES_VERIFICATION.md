# Traveller Trade Route Calculator — Rules Verification

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
- RV-04/05: all price percentages/endpoints, source modifier signs, largest-per-column selection and negative-only matches.
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
