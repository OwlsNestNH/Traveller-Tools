# Initial Core Rulebook review

Review date: 2026-10-03. Reviewer: Codex. Evidence revision: 1.
Status: source review in progress; not approval of an implementation or a complete rules dataset.

## Source baseline

The checked source identifies itself as *Traveller Core Rulebook Update 2022*, with copyright 2024 on its credits page. References below use printed page numbers, not PDF viewer positions. This identifies the examined revision; the title alone is insufficient to distinguish revisions.

The publisher's [official downloads page](https://www.mongoosepublishing.com/pages/downloads-htm) lists the August 2024 Core Rulebook FAQ. Its four pages were reviewed: no changes were found to the trade rules on pp. 238–245 or trade-code table on p. 260. Its travel-time clarification concerns interplanetary travel on p. 163, not jump duration. This records the FAQ checked, not a guarantee that every later clarification has been found.

No PDF, extracted book pages, private access link, account identifier, or chat reference is part of this repository. The eventual app must use checked-in data and public references, without opening a rulebook at runtime. The existing spec-trade tool was not used as rules evidence.

## Findings to carry into the verified dataset

| Area | Printed source | Finding |
| --- | --- | --- |
| Supplier search | 241–242 | Broker or Streetwise search takes 1D days; online Admin search requires TL8+ and takes 1D hours. Each prior attempt on the same planet in the same month imposes -1. Starport A/B/C supplies +6/+4/+2 respectively. |
| Availability | 242 | Common goods, matching trade-code goods and population-based random goods are separate inputs. Repeated random commodities add quantities. Population 3 or below gives -3 to quantity rolls; population 9 or above gives +3, before the tonnage multiplier. Nonpositive quantity means none. |
| Negotiation | 243 | Use the trader's skill OR the hired broker's skill. Select the largest applicable DM from each price column, not their sum. Purchase adds Purchase DM and subtracts Sale DM; sale reverses those signs. Counterparty Broker defaults to 2. |
| Price lookup | 243 | Purchase and sale percentages use separate columns. Clamp results at the -3 and 25 endpoint rows. Apply the percentage to the commodity base price. |
| Brokers | 242 | Local brokers have skill 2D/3, negotiation +2 and normally a 10% fee on gross transaction proceeds. Illegal fixers normally charge 20%, potentially more. A natural 2 on fixer skill generation flags a referee event. |
| Illegal goods | 242–243, 255–256 | Distinguish universally illegal commodities from locally prohibited items. Local sale DM is world law minus the item's ban threshold. Where both apply, use the higher illegal sale DM, not their sum. Item classification and referee exceptions need explicit inputs. |
| Freight | 239–241 | Lots cannot be divided. Payment is on delivery; late delivery reduces payment by (1D+4) × 10%. A contract needs an explicit due date to evaluate lateness. |
| Mail | 241 | Availability succeeds on 12+. Roll 1D containers, each occupying 5 tons and paying Cr25000. Accept all containers or none. Payment is independent of distance. |
| Jump duration | 157 | Duration is 148 + 6D hours, regardless of distance. Retain hours across date changes; do not round each jump to seven days. |
| Fuel and trade codes | 157, 257, 260 | Fuel availability depends on port facilities and ship collection capability. Trade-code conditions require local derivation; travel-zone classifications remain separate inputs. Full boundary verification is still pending. |

Rejecting a negotiated offer invokes the rulebook's repeat-dealing restriction (p. 243). Merely browsing away is not a rejection. Existing project policy keeps historical offers actionable unless explicitly expired. INT-006 records the agreed reconciliation: explicit rejection starts a counterparty cooldown; browsing never starts it or silently expires offers. During the cooldown, affected offers remain in history but cannot be committed with that counterparty. Eligibility returns after the cooldown, subject to quantity, expiration and other normal checks.

Full fuel consumption, jump engineering checks, misjump simulation and interplanetary flight simulation remain outside the agreed V1 scope. Referee time adjustments can represent their consequences.

## Worked expected results

These are independently calculated expectations for later data and implementation checks. They have not been compared with an app, and do not establish that an uncreated dataset is correct.

| Case | Inputs and calculation | Expected result |
| --- | --- | --- |
| E-01 Purchase DM selection | Synthetic commodity: base Cr1000/t; 3D total 10; trader Broker 2; applicable Purchase DMs +2,+3; Sale DM +1; supplier Broker 2. Result = 10+2+3-1-2 = 12. Page 243 purchase percentage is 80%. | Cr800/t; do not add both Purchase DMs. |
| E-02 Sale direction | Same synthetic inputs, reversing the two commodity DM columns: 10+2+1-3-2 = 8. Page 243 sale percentage is 80%. | Cr800/t. |
| E-03 Endpoint lookup | Synthetic base Cr1000/t; modified roll -4 or 26. Page 243 endpoints apply. | At -4: buy Cr3000/t, sell Cr100/t. At 26: buy Cr150/t, sell Cr4000/t. |
| E-04 Small market quantity | Quantity expression 1D × 5; die 2; population 3 gives -3 before multiplication. | Zero available, not negative tons. |
| E-05 Large market quantity | Quantity expression 1D × 5; die 2; population 9 gives +3 before multiplication. | 25 tons. |
| E-06 Mail | Successful availability check; container die 4. | 20 tons required and Cr100000 on delivery; accepting only three is invalid. |
| E-07 Late freight | Agreed payment Cr10000; late penalty die 2. Reduction = (2+4) × 10% = 60%. | Cr4000 payable. |
| E-08 Jump hours | Six dice all 1, all 6, or totalling 21. Add 148. | 154, 184, or 169 hours respectively. |
| E-09 Reduced profit (house rule) | Gross sale Cr1500; selling fee Cr150; allocated acquisition basis Cr1249. RAW profit = 101. Adjusted = floor(101 × .75) = 75. | Profit adjustment -26; bank credit Cr1324. Acquisition cost is not debited again. |
| E-10 Basis remainder (app policy) | Lot 3 tons, remaining basis Cr100. Sell 1 ton, then 1 ton, then final 1 ton. Proportionate allocation floors interim amounts. | Basis allocations Cr33, Cr33, Cr34; total Cr100. |

E-09 and E-10 validate the arithmetic specified in REQUIREMENTS.md, not a Core Rulebook profit-reduction rule.

## Review outcomes and remaining work

1. Broker skill rounding is resolved for this app by INT-001 below; it is an explicit interpretation, not a claim that the broker passage states a rounding rule.
2. Mail's low-tech endpoint is resolved by INT-002. The freight DM composition is resolved by INT-004.
3. Black-market stock is resolved for this app by INT-003, including common legal goods. Preserve legality per commodity; buying from a black-market supplier alone does not label common goods universally illegal.
4. Freight deadlines and month handling are resolved by INT-005. Referee-entered due dates are required for lateness calculation; no universal deadline is inferred.
5. Some commodity names in the availability example differ from the actual Trade Goods table. Use the table on pp. 244–245 as the dataset basis and retain this discrepancy in the audit.
6. Create and independently check the versioned commodity, price, UWP/trade-code, freight and mail data. Check every row, sign and boundary, then compare the data against worked cases. No dataset has been approved yet.
7. Verify the remaining accounting examples and, after implementation is authorized, exercise persistence, recovery, tab ownership and commit workflows.

Until the remaining dataset and verification work is complete, the [verification gate](RULES_VERIFICATION.md) remains open. Manual overrides must preserve the original inputs and identify an interpretation or referee decision; they must never make unresolved data appear verified.

## Interpretation decision register

Ambiguous rules are put to the owner before adoption. Conclusions appear in the Rules & Notes panel and affected audits. Revision 1; all six decisions below were explicitly approved on 2026-10-03. These resolve project behavior without claiming the source wording is unambiguous.

| ID | Question | Interpretation and rationale | Status |
| --- | --- | --- | --- |
| INT-001 | Fractional local broker skill from 2D/3 | floor(2D/3); explicit owner choice for whole-number skill. A total of 2 yields skill 0; totals 5 and 11 yield 1 and 3. Retain the natural-2 fixer warning separately. | Agreed 2026-10-03; revision 1 |
| INT-002 | Endpoint for mail low-tech penalty | Origin world only; availability is evaluated where mail is collected. | Agreed 2026-10-03; revision 1 |
| INT-003 | Black-market stock/count | Include common legal goods, matching illegal goods, and population-count random rolls on the black-market table; exotics are referee-defined. Explicit owner choice to include common legal stock. Normal quantity modifiers and duplicate additions apply. | Agreed 2026-10-03; revision 1 |
| INT-004 | Freight DM for mail | Route/world modifiers plus freight-search Effect, excluding major/incidental lot modifiers; mail uses general freight traffic rather than a particular lot class. | Agreed 2026-10-03; revision 1 |
| INT-005 | Freight deadlines and month convention | Referee-entered deadlines; rolling 30-day search window and 30-day rejection cooldown. Explicit app convention for predictable elapsed-time accounting, not the literal calendar-month wording. Count prior attempts at the same world less than 720 hours ago; cooldown ends at 720 elapsed hours. | Agreed 2026-10-03; revision 1 |
| INT-006 | Rejection versus browsing | Explicit Reject deal starts counterparty cooldown; browsing leaves offers active. Preserve counterparty identity across searches so another snapshot cannot bypass the cooldown. | Agreed 2026-10-03; revision 1 |

Record subsequent conclusions, rationale and dates here; preserve these IDs in future versioned app notes. Any newly discovered ambiguity must be raised before its dependent behavior is finalized.
