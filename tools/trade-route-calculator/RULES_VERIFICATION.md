# Traveller Trade Route Calculator — Rules Verification

**Overall status: Source/data gate complete for version 0.1.0 — application verification pending.**

This is the public status and evidence record for the calculator. It tracks the verification required by [REQUIREMENTS.md](REQUIREMENTS.md#rules-verification-before-implementation) and [ARCHITECTURE.md](ARCHITECTURE.md#rules-verification-gate). A planning decision or a checked box without supporting evidence is not rules verification.

## Baseline and deliverables

- Intended rulebook: Traveller Core Rulebook Update 2022.
- Examined source: Core Rulebook Update 2022, copyright 2024; August 2024 publisher FAQ reviewed. See [source baseline](RULES_REVIEW.md#source-baseline).
- Verified source/data version: 0.1.0; [data, source coverage and checks](rules/README.md).
- Initial source references: [RULES_REVIEW.md](RULES_REVIEW.md); complete dataset provenance remains pending.
- Initial independently calculated expectations: [worked results](RULES_REVIEW.md#worked-expected-results). Dataset comparison and implementation tests remain pending.
- App implementation and automated rule checks: not yet created.

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
| PV-01 | Per-lot profit modes | Pending | RAW Cr101 profit becomes Cr75 in Reduced; losses/zero unchanged; RAW/Custom modes |
| PV-02 | Separate profitable and losing lots | Pending | Cr100 profit plus Cr100 loss becomes a combined Cr25 loss in Reduced |
| PV-03 | Bank, fees and cost basis | Pending | Acquisition debited once; partial-sale basis and fee remainders reconcile |
| PV-04 | Rounding and fractional cargo | Pending | Whole-Credit round-down without discarding decimal tons |
| PV-05 | Freight/mail exclusion | Pending | Contract payments unaffected by speculative profit settings |
| PV-06 | Fewest-jumps routing | Pending | Mandatory stop order, jump/fuel checks, tie-breaking and failed connections |
| PV-07 | Browsing versus COMMIT JUMP | Pending | Browsing changes no actual location/date or delivery state |
| PV-08 | Per-offer expiration | Pending | One expired offer leaves others active; reactivation/bulk action and undo |
| PV-09 | Historical evidence and recovery | Pending | Snapshot inputs and rules version survive reload/import; undo reconciles state |
| PV-10 | Mid-campaign setup | Pending | Opening cargo does not debit the opening bank; separate lots/bases remain intact |
| PV-11 | Referee corrections | Pending | Reasons and before/after values preserved; basis changes and undo reconcile |
| PV-12 | Backup/import/reset | Pending | Backup offered before replacement; confirmation/cancel and failure handling preserve data |
| PV-13 | Concurrent tabs | Pending | One writer; stale previews rejected; transfer reloads latest revision without lost updates |

Worked expected results can be verified before code exists. Automated implementation tests remain a separate later check; do not imply they have run.

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

Record the verified dataset version and immutable commit here when that gate is met. The source/data gate for 0.1.0 is complete; application testing remains pending. Source review and worked expectations must not be presented as a tested app.

## Optional first-edition verification

Insurance and taxation were added as independently optional V1 features on 2026-10-03. [OPTIONAL_RULES.md](OPTIONAL_RULES.md) records the source supplied by the owner, approved interpretations and remaining questions. Approval of an interpretation does not verify a source table.

| ID | Area | Status | Required evidence |
| --- | --- | --- | --- |
| OV-01 | Merchant Prince source | Verified (source/data) | First-edition Book 7 identity and printed references supplied by owner: insurance p. 83; taxes p. 86. INT-022 fixes the supplied tables as the baseline; later errata require a new reviewed version |
| OV-02 | Insurance | Verified (source/data) | Complete rates; approved distance/risk/value rules; premium and claims examples; partial-loss handling |
| OV-03 | Taxation | Verified (source/data) | Complete rates; INT-007/009; benchmark mapping, aggregation, allocation and boundary examples |
| OV-04 | Tax and profit modes | Verified (source/data) | INT-008; independently verify the Cr80000 example and loss/zero/off cases against the eventual data and implementation |
| OV-05 | Persistence and transactions | Pending | Default-off switches, frozen audits, policy/claim/tax exports, duplicate prevention and atomic undo |

Optional calculations must not be implemented before the relevant source/data and interpretation checks pass; lifecycle and persistence checks require later implementation. The source/data gate and optional-module source checks are complete for 0.1.0; lifecycle and application tests remain pending.

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

The app/house-rule rows above remain pending **implementation** tests. Passing reference-data checks does not test browser persistence, routes, interface actions, duplicate prevention, concurrency or undo. The user has authorized implementation after this source/data gate; continue to raise newly discovered ambiguities.
