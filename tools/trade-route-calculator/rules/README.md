# Rules data review — 0.1.0

This is the **source/data-verified version 0.1.0**. Application implementation and its tests are separate. Data and decisions live in this repository; private PDFs, source scans and personal links are not required by the future runtime.

## Files

- [core-2022.json](core-2022.json): 36 D66 entries including referee-defined Exotics, 29 price-result rows, 18 locally derived trade-code conditions, supplier/negotiation, freight/mail and jump/fuel values.
- [merchant-prince-1e.json](merchant-prince-1e.json): seven distance rows with nine coverage levels, ten tax bands and fourteen government rows; optional rules remain off by default.
- [../OPTIONAL_RULES.md](../OPTIONAL_RULES.md): source attribution and approved INT-007 through INT-021.
- [../verification/check_rules.py](../verification/check_rules.py): standalone data validation, requiring only Python's standard library. It is development tooling, not a runtime dependency.

Run from any directory: `python path/to/verification/check_rules.py`.

## Source coverage and review

Reviewer: Codex. Review date: 2026-10-03.

| Data | Reference | Review performed |
| --- | --- | --- |
| Commodity values, quantities, availability and DMs | Core Rulebook Update 2022, copyright 2024, pp. 244–245 | Visually compared the two table pages with transcribed numeric data; omitted illustrative prose |
| Price percentages and modifier combination | Same source, p. 243 | Visually compared all rows and the largest-per-column rule; preserve negative-only matches |
| Trade-code conditions | Same source, p. 260 | Visually checked field columns and boundaries, including Rich government condition and Waterworld atmosphere gap |
| Supplier availability/search and broker rules | Same source, pp. 241–243 | Reviewed text; preserve source population DM before tonnage multiplier and agreed interpretations |
| Freight/mail | Same source, pp. 239–241 | Compared extracted tables/text; initial boundary and payout cases checked; combined endpoint/DM cases now checked |
| Jump duration and fuel | Same source, pp. 157, 257 | Compared source values; fuel-consumption simulation remains excluded |
| Map UWP transport format | [Traveller Map Second Survey documentation](https://travellermap.com/doc/secondsurvey) | Field order and extended hexadecimal encoding checked; use local Core trade-code conditions, not Map trade-code rules |
| Optional insurance | Merchant Prince, first edition Book 7, p. 83 | Compared supplied table image; checked worked premium/payout and arithmetic correction |
| Optional tax | Same source, p. 86 | Compared supplied table image; preserve approved bracket correction and government-label mapping |

Core Rulebook errata review is recorded in [RULES_REVIEW.md](../RULES_REVIEW.md). INT-022 fixes the exact supplied Merchant Prince tables as the baseline; no unidentified printing/errata changes are applied. Source identity and page numbers for its supplied excerpts were provided by the owner.

## Validation result and limits

Latest run: **198 assertions passed**, including data dimensions and code references, price endpoints, selected trade-code boundaries, freight/mail payouts, jump bounds, insurance arithmetic, corrected tax bands, fractional bracket selection, mixed-sale tax allocation, acquisition-basis remainders and accounting order.

These checks exercise the transcribed data and independent fixed expected values. They do not prove the complete rulebook transcription, test a deployed app, or test a deployed app; the source/data gate is documented separately.

The source/data gate is complete in [RULES_VERIFICATION.md](../RULES_VERIFICATION.md). Combined freight/mail DMs, broker fees with partial lots, local illegality and unknown/malformed UWP examples are now present. Record any correction and bump the data version; do not silently overwrite historical version references.

## Worked policy expectations

- Insurance: Cr80800 insured goods value, three parsecs, 70% payout and an Amber route: 11% premium = Cr8888, total purchase plus premium Cr89688, potential payout Cr56560.
- Partial loss: ten insured tons purchased for Cr10000; two tons lost; 70% coverage: referee-approved claim Cr1400 and original purchase value of remaining insured cargo Cr8000.
- Tax/Reduced: sale Cr80000, benchmark Cr70000, actual cost basis Cr60000, no selling fees, 8% tax: taxable profit Cr10000, tax Cr800, actual after-tax profit Cr19200, adjusted profit Cr14400, bank credit Cr74400.
- Mixed sale: taxable gains +Cr6000, +Cr4000 and -Cr2000 produce Cr8000 taxable total. At 8%, tax is Cr640, allocated Cr384/Cr256/Cr0.
- Criminal-market sale: zero automatic tax; any protection payment is a separately committed manual expense.
- Fractional taxable profit Cr1000.75 uses the first bracket; at 5%, final posted tax is Cr50.

The tax and insurance policy expectations are owner-approved adaptations. They must be shown as such in Rules & Notes.
