# Optional insurance and taxation

Status: agreed optional V1 scope; documentation only. Source/data verification is recorded for version 0.1.0; application verification is separate.

## Source and presentation

Source identified by the project owner: **Mongoose Traveller 1st Edition, Book 7: Merchant Prince**, sections on purchasing goods/insurance and paying taxes. The supplied excerpts and table images are the current review evidence. Printed references supplied by the owner: **insurance p. 83; taxes p. 86**. Include these references in Rules & Notes and the affected calculation audits. INT-022 fixes the exact supplied tables as the authoritative adaptation baseline; unidentified printing/errata changes are not applied. Any later source change requires a new reviewed version.

These are **optional first-edition rules adapted for the Core Rulebook Update 2022 baseline**, not rules asserted to be in that Core Rulebook. Insurance and taxation are independent campaign settings, both off by default. Enabling one does not enable the other or change the selected profit mode.

Rules & Notes must identify the source, adaptation status, approved interpretations and remaining verification gaps. Each affected purchase/sale audit links to those notes. Store applied settings, input values, rates, rolls, overrides, rules version and decision revisions with the transaction. Later setting changes do not rewrite history.

Do not bundle source scans/PDFs or require access to the owner, their files, or this conversation. Before implementation, check the relevant numerical data and concise provenance into GitHub.

## Cargo insurance

Allow coverage for selected owned-trade cargo lots and a named destination. Preview the insured value, coverage percentage, route inputs, premium and possible payout before commitment. Link the policy to the covered quantities and cargo lots; record the premium as an identifiable ledger debit.

Claims require an explicit referee-approved loss and payout action, with reason and linked loss record. Prevent duplicate payout and reconcile affected cargo, remaining coverage and history. Successful arrival does not refund the premium. Browsing a destination or changing a planned route must never settle a policy.

The supplied worked example contains an arithmetic error: an Cr80800 purchase plus an 11% premium of Cr8888 totals **Cr89688**, not Cr89680. A 70% payout on Cr80800 is **Cr56560**. These are checked arithmetic results, not verification of every policy rule.

## Tax decisions approved 2026-10-03

| Decision | Agreed behavior | Classification |
| --- | --- | --- |
| INT-007 | Calculate taxable profit against normal market value, separately from profit measured against actual acquisition cost. Display both measures; do not substitute purchase cost for the tax benchmark. | Adopted supplementary-rule definition |
| INT-008 | Deduct tax before applying RAW/Reduced/Custom profit mode to any remaining positive actual profit. Insurance and taxation remain independently optional. | Explicit adaptation/house-rule interaction |
| INT-009 | Correct the displayed Cr76001–100000 bracket to **Cr75001–100000** so there is no gap after Cr75000. | Owner-approved table correction, not a claimed publisher erratum |

The sale preview shows the market-value benchmark, taxable amount, government/organisation, rate and tax due. Record tax separately in the ledger as part of the committed sale. For a finalized posted tax amount allocated to a sold lot:

```text
rawProfit = grossSaleProceeds - sellingFees - allocatedCostBasis
profitAfterTax = rawProfit - allocatedTax
adjustedProfit = profitAfterTax > 0
    ? floor(profitAfterTax * selectedPercentage / 100)
    : profitAfterTax
profitAdjustment = adjustedProfit - profitAfterTax
bankIncreaseOnSale = grossSaleProceeds - sellingFees - allocatedTax + profitAdjustment
```

With taxes disabled, allocatedTax is zero and existing behavior is unchanged. Tax can create or deepen an actual loss even when taxable profit is positive; the profit-mode percentage must not reduce that loss. Do not deduct historical acquisition cost again from the bank.

Illustrative expectation: proceeds Cr80000; market benchmark Cr70000; tax Cr800 at the supplied 8% example rate; actual allocated acquisition basis Cr60000; no selling fee. Taxable profit is Cr10000; actual pre-tax profit is Cr20000; after-tax profit is Cr19200. Reduced profit is Cr14400, with a separate -Cr4800 profit adjustment and a bank credit of Cr74400. This example fixes the ordering; it does not settle the aggregation questions below.

## Additional decisions approved 2026-10-03

All decisions below are revision 1. They are explicit app interpretations; where they differ from the supplied source, identify the difference in Rules & Notes.

| ID | Topic | Agreed behavior |
| --- | --- | --- |
| INT-010 | Tax brackets | One bracket and rate per committed sale, not per lot or per day. |
| INT-011 | Insured distance | Sum the planned route's legs. Beyond six parsecs require a referee-entered premium. |
| INT-012 | Risk surcharges | Add Amber +2 and Red +5 percentage points once each; a mixed route adds +7. |
| INT-013 | Route amendments | Retain original policy terms; changed routes require an explicit referee-approved policy amendment. |
| INT-014 | Insured value and costs | Insure goods' purchase value only, excluding broker fees and premium. Add the premium to lot acquisition cost basis for actual-profit accounting. |
| INT-015 | Partial claims | Referee-approved claim equals coverage percentage times original goods purchase value of the lost insured quantity. Reduce remaining coverage; sales end coverage on sold quantities. |
| INT-016 | Taxable-sale benchmark | Core Rulebook base price times tons sold. Net gains and losses across the entire sale. No tax when the net taxable amount is zero or negative. |
| INT-017 | Tax allocation | Allocate the sale's posted tax among positive-taxable-gain lots proportionally to those gains. Losses reduce total taxable profit but receive no tax share. Whole-Credit remainders must reconcile deterministically. |
| INT-018 | Criminal-market exemption | No automatic tax or criminal surcharge on criminal-market sales. Bribes/protection payments are manual expenses. This replaces the source's criminal-market formula. |
| INT-019 | Optional-rule scope | Owned speculative-trade goods only. Freight/mail and insurance claim payouts are excluded from tax and profit reduction; freight/mail cargo is excluded from cargo insurance. |
| INT-020 | Government-code mapping | Map the source row labelled Feudal Democracy to UWP government code 5, Feudal Technocracy, and retain the naming discrepancy in notes. |
| INT-021 | Fractional tax bracket lookup | Use floor(taxable profit) only for bracket selection, using the first bracket for positive amounts below Cr1. Preserve full taxable precision for the percentage calculation; floor the final tax once. |

One sale commit has one market classification and tax jurisdiction. Preserve the classification with the sale. A criminal-market exemption does not make its goods legal.

Implementation detail for INT-017: allocate exact tax shares, floor each, then distribute remaining whole Credits by descending fractional remainder, breaking ties by stable lot ID. This implements the agreed deterministic reconciliation without changing the total tax. Exclude nonpositive-taxable-gain lines from the allocation denominator.

Insurance amendments must preserve the original terms and record referee approval, reason, changed route/coverage and any explicitly entered premium adjustment. No automatic refund or increased coverage is inferred. Premiums already paid remain in recorded lot cost basis unless an explicit accounting correction changes them.

## Verification status

The initial versioned data and reproducible checks are in [rules/README.md](rules/README.md). INT-022, approved 2026-10-03, revision 1: use the exact supplied tables with the agreed corrections and house rules. Later changes require a new reviewed rules version. Newly discovered ambiguities must still be put to the owner. No runtime app depends on private files.

## Required checks

Verify the complete insurance and tax tables, source provenance and approved corrections. Cover bracket boundaries (including Cr75000/75001/76000/76001), fractional percentage premiums, separate taxable/actual profit, tax-induced losses, tax off, RAW/Reduced/Custom ordering, policy lifecycle, duplicate claims, partial lots, export/import and atomic undo. Source/data checks have run; no application tests have run yet.
