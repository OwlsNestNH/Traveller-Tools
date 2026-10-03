# Traveller Trade Route Calculator — Rules Verification

**Overall status: Pending — rules have not yet been independently verified.**

This is the public status and evidence record for the calculator. It tracks the verification required by [REQUIREMENTS.md](REQUIREMENTS.md#rules-verification-before-implementation) and [ARCHITECTURE.md](ARCHITECTURE.md#rules-verification-gate). A planning decision or a checked box without supporting evidence is not rules verification.

## Baseline and deliverables

- Intended rulebook: Traveller Core Rulebook Update 2022.
- Exact source edition/update and applicable errata: pending confirmation.
- Verified rules dataset/version: not yet created.
- Source page/table references: not yet recorded.
- Independently checked worked examples: not yet recorded.
- App implementation and automated rule checks: not yet created.

Keep the rules data, concise source references, examples, and results in GitHub. Do not upload PDFs, add private source links, or make the app depend on the user's files/accounts or design chat. The existing `tools/spec-trade/` implementation is buggy/untrusted and cannot establish correctness.

## Core Rulebook verification checklist

All rows start Pending. Add links to actual checked-in evidence as work is completed; do not create placeholder links to files that do not exist.

| ID | Area | Status | Evidence needed |
| --- | --- | --- | --- |
| RV-01 | Edition and errata | Pending | Exact source identity and applicable errata recorded |
| RV-02 | UWP parsing and trade-code derivation | Pending | Rule references, boundary values, and expected codes |
| RV-03 | Commodity availability and tonnage | Pending | Verified data, availability conditions, rolls, and quantity examples |
| RV-04 | Purchase and sale pricing | Pending | Base prices, percentage tables, lookup boundaries, worked examples |
| RV-05 | DMs and combination rules | Pending | Each modifier's source, signs, selection/stacking behavior, combined examples |
| RV-06 | Local brokers and fees | Pending | Eligibility, skills/DMs, fee bases, and purchase/sale examples |
| RV-07 | Illegal goods | Pending | Applicable availability, pricing, and legality rules with examples |
| RV-08 | Freight | Pending | Availability, DMs, rolls, tonnage, payment and delivery rules |
| RV-09 | Mail | Pending | Eligibility, availability, payment and delivery rules |
| RV-10 | Travel and dates | Pending | Jump capability, fuel-availability inputs, elapsed-time rules and examples |

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

Record the verified dataset version and immutable commit here when that gate is met. Until then, the overall status remains Pending. This file adds visibility; it does not claim verification has taken place.
