# Optional insurance and taxation

Status: agreed optional V1 scope; documentation only. Source verification and the unresolved adaptation details below remain pending.

## Source and presentation

Source identified by the project owner: **Mongoose Traveller 1st Edition, Book 7: Merchant Prince**, sections on purchasing goods/insurance and paying taxes. The supplied excerpts and table images are the current review evidence. Printed references supplied by the owner: **insurance p. 83; taxes p. 86**. Include these references in Rules & Notes and the affected calculation audits. Exact printing and applicable errata remain unconfirmed; recording page references does not establish that the complete rules data has been verified.

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

## Questions to put to the owner before implementation

Do not guess or silently supply defaults for these remaining ambiguities:

- Insurance distance: direct separation, total planned route distance, or individual legs; treatment of distances above six parsecs.
- Amber/Red surcharges: once per category, cumulative when both occur, or only the highest; treatment of changes to an insured route.
- Exact insured value and premium accounting: inclusion of broker fees, whether premiums enter lot cost basis, and partial sale/loss/claim treatment.
- Meaning of normal market value in the newer commodity dataset; whether the tax bracket applies per lot, per sale, or to a day's combined trade, including mixed gains and losses.
- How shared tax is allocated across lots; tax treatment of nonpositive taxable amounts; unsupported government codes; and the criminal-market formula's percentage/roll interpretation.
- Scope of tax/insurance treatment for freight, mail and claim payouts. Do not automatically extend speculative-goods rules to these payments.

These unresolved details do not undo INT-007 through INT-009. Resolve them through owner decisions and update this record before implementing their dependent behavior.

## Required checks

Verify the complete insurance and tax tables, source provenance and approved corrections. Cover bracket boundaries (including Cr75000/75001/76000/76001), fractional percentage premiums, separate taxable/actual profit, tax-induced losses, tax off, RAW/Reduced/Custom ordering, policy lifecycle, duplicate claims, partial lots, export/import and atomic undo. No implementation tests have run.
