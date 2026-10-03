# Traveller Trade Route Calculator — Rules Verification

**Overall status: In progress — initial source review recorded; the verification gate is not complete.**

This is the public status and evidence record for the calculator. It tracks the verification required by [REQUIREMENTS.md](REQUIREMENTS.md#rules-verification-before-implementation) and [ARCHITECTURE.md](ARCHITECTURE.md#rules-verification-gate). A planning decision or a checked box without supporting evidence is not rules verification.

## Baseline and deliverables

- Intended rulebook: Traveller Core Rulebook Update 2022.
- Examined source: Core Rulebook Update 2022, copyright 2024; August 2024 publisher FAQ reviewed. See [source baseline](RULES_REVIEW.md#source-baseline).
- Verified rules dataset/version: not yet created.
- Initial source references: [RULES_REVIEW.md](RULES_REVIEW.md); complete dataset provenance remains pending.
- Initial independently calculated expectations: [worked results](RULES_REVIEW.md#worked-expected-results). Dataset comparison and implementation tests remain pending.
- App implementation and automated rule checks: not yet created.

Keep the rules data, concise source references, examples, and results in GitHub. Do not upload PDFs, add private source links, or make the app depend on the user's files/accounts or design chat. The existing `tools/spec-trade/` implementation is buggy/untrusted and cannot establish correctness.

## Core Rulebook verification checklist

Initial source findings and unresolved interpretations are recorded in [RULES_REVIEW.md](RULES_REVIEW.md). In progress means evidence gathering has begun; it does not mean the complete area has passed.

| ID | Area | Status | Evidence needed |
| --- | --- | --- | --- |
| RV-01 | Edition and errata | In progress | Exact source identity and applicable errata recorded |
| RV-02 | UWP parsing and trade-code derivation | In progress | Rule references, boundary values, and expected codes |
| RV-03 | Commodity availability and tonnage | In progress | Verified data, availability conditions, rolls, and quantity examples |
| RV-04 | Purchase and sale pricing | In progress | Base prices, percentage tables, lookup boundaries, worked examples |
| RV-05 | DMs and combination rules | In progress | Each modifier's source, signs, selection/stacking behavior, combined examples |
| RV-06 | Local brokers and fees | In progress | Eligibility, skills/DMs, fee bases, and purchase/sale examples |
| RV-07 | Illegal goods | In progress | Applicable availability, pricing, and legality rules with examples |
| RV-08 | Freight | In progress | Availability, DMs, rolls, tonnage, payment and delivery rules |
| RV-09 | Mail | In progress | Eligibility, availability, payment and delivery rules |
| RV-10 | Travel and dates | In progress | Jump capability, fuel-availability inputs, elapsed-time rules and examples |

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

Record the verified dataset version and immutable commit here when that gate is met. Until then, the overall status remains In progress. Source review and worked expectations must not be presented as a completed dataset or tested app.
