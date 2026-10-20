# Cargo management candidate

Cargo shows separate speculative lots with name, description, stored tons, retail
reference, frozen actual purchase quote, and Sell into the normal Trade Sell flow.
Empty rows/categories disappear only after committed removal. Pending zero rows
stay visible and restorable. Internal life support stays on Life Support.

## Removal and normalization

Right-side controls specify whole tons remaining, from zero through the original
rounded-up quantity. Down removes one pending ton; up restores it. Cancel or
navigation discards the local draft. Only Confirm Removal writes the campaign.
The footer shows original and revised cargo totals, tons removed, upward rounding
and capacity impact. Over-capacity candidates cannot commit. Existing fractional
trade/transport/luggage quantities normalize upward once, inside that same audited,
undoable transaction. No load/render/import migration runs implicitly. Legacy day-based stock that would introduce cargo overflow during conversion must first be confirmed in Life Support settings (Ship, trader & options); Cargo shows this concrete precondition instead of a stale-preview retry loop.

Trade goods retain their separate lots, frozen purchase quotes and historical
cost until removed. Partial removal proportionally writes off remaining basis and
goods value using the existing integer-credit convention. Insurance coverage is
reduced without a claim or payout; normalization adds no insurance coverage.

Freight/mail loss persists an audit. Partial lots stay aboard; complete losses
leave the hold. Both block ordinary contract delivery/payment and mail cancellation.
The original promised payment stays as a historical reference; no prorated payment,
penalty or compensation is invented. Luggage loss leaves passengers and support
headcounts unchanged. Adjustments belong to their baseline or individual booking,
so later bookings retain their own allowance and delivered bookings leave no
phantom rounding reservation. Every Cargo removal leaves the ledger/bank unchanged.
Fuel removal affects only fuel in bladders; installed passenger accommodation is
fixed hold use, not removable cargo.

## Life support reserves

Cargo normalization adopts whole-ton reserve handling: 100 LSS per reserve ton.
Actual supplies remain exact; 101.5 LSS reserves **2 t total**, never extra supplies.
Removing reserved space discards only cargo supplies that no longer fit and never
removes internal supplies. The preview states the resulting supply loss.

In the reserve model, supplies are consumed internally. A complete 100-LSS reserve
moves automatically only when internal storage has room for the whole batch.
Hourly/large/split consumption retains exact rational balances and conserves total
supplies. New campaign setup uses this model; existing saves retain their recorded
rules until explicitly normalized through Cargo, preserving safe read/import/Undo.

Legacy fractional cargo reserves are retained exactly, with upward-rounded space.
Complete batches may transfer; the residual fraction is never silently transferred,
consumed from cargo, discarded or converted into extra supplies. Unsupported legacy
residual stock does not inflate usable endurance. Batch-mode refill adds/removes
100-LSS lots while retaining that residual; its native input step starts from the
residual. Nonterminating legacy fractions use exact batch buttons with a read-only approximate numeric display. Fill respects whole reserved-space capacity. Refill previews include any
complete-batch transfer into internal space. Existing payment, comfort spending,
internal refill fraction policy and explicit GM adjustment boundaries remain.

## Save safety and verification

A removal preview captures the campaign revision and original entries. A stale
preview fails before saving. Its save owner freezes controls, rejects repeat clicks,
and verifies publication and durable state before clearing the draft. Definitely
rejected writes retain the draft for retry; uncertain/committed-publication failures
require reload and History verification. Native and real-Chrome checks cover
normalization, cancellation/restoration, capacity, separate costs, partial/full
loss, passenger retention, repeat clicks, navigation/reload, quota failure/retry,
whole reserve transfer boundaries and native fractional-tail spinner stepping.

## Referee Add / Adjust

Cargo opens one Type dropdown: Trade Goods, Freight, Mail, Passengers, Other.
Trade Goods uses the existing add-lot operation with explicit whole tons and
purchase cost per ton (whole Credits; 0 means free). The per-ton reference and
exact whole-lot basis are recorded without charging the bank or applying the
campaign's 100-Credit convenience rounding. Each addition remains a separate lot;
normal buyer negotiation and confirmation remain in Trade Sell.

Freight and Mail reuse manual contract acceptance. Passengers reuse the existing
capacity checks, boarding preview and confirmation. They retain normal delivery
payment timing, luggage and LSS rules. Type changes and modal cancellation do not
save. New cargo operations reuse the established owned contract-lifecycle save
boundary for repeat-click, stale-state, rejected-write and uncertain-publication
protection; no duplicate persistence path is introduced.

Other cargo is an optional separate `otherCargo` array, never a commodity mapping.
Its first addition atomically adopts campaign format 2 so older calculators reject
the file rather than ignoring hold occupancy. Untouched legacy campaigns remain
format 1; current validation accepts 1 and 2 without migrating or downgrading.
Sale/full loss retains format 2, including retained audit/Undo. Undoing the original
addition restores format 1 and field absence. The storage key is unchanged.
Item/description, whole cargo-space tons and optional whole-lot sale value are
separate fields. Missing price stays unspecified; zero means free. Whole-lot sale
requires an explicit total and confirmation, removes the entire item once and
posts only that total as `Other cargo sale`. It does not generate commodity rolls,
fees, tax or invented speculative profit. Add, adjust and disposal do not pay.
Partial loss clears the previous sale value and retains it in the loss audit,
requiring a new explicit value before selling the remainder. Nothing prorates an
arbitrary item's whole-lot price by its cargo space.

Other quantities participate in capacity, both manifests, removal and reports.
Player-safe briefing keeps a neutral item reference and quantity/value while
preserving the existing exclusion of free-text cargo descriptions and GM reasons.
JSON backups and inverse Undo retain records, values and absence exactly.

## Focused Sell / Cargo simplification (candidate)

**Add cargo** is visible at the top of Cargo and alongside the Sell actions.
Commodity, whole tons (default 1) and recorded paid Credits per ton (explicitly
labelled `0 = free`) are the ordinary trade fields. Description, acquisition note
and legality remain under **Description and acquisition details**. A blank trade
description uses the chosen commodity name; the form identifies the current world/date as the time of adding the record
and defaults the note to `Cargo already aboard`. Other cargo retains its required
description and optional whole-lot sale value. Optional acquisition location and Imperial date are retained as GM metadata,
separate from the current transaction world/time. No purchase total, percentage
or retail-override input has been invented. Freight, Mail and
Passengers retain their existing forms through Type.

Cargo's bulk whole-ton adjustment/loss controls now require **Remove / adjust
hold**. Cancel or leaving Cargo discards the draft and closes that mode. This is
still the existing normalization operation, including its explicit multi-category
preview, and must not be confused with per-lot Delete. Cargo help is available
from the circled information button. Lot identities and detailed purchase evidence
remain in Audit. Sell's redundant selection/financial/capacity summary box is
removed; hidden selected lots remain counted beside the action, and the actual
sale review still presents quantities, proceeds, costs, fees, tax and capacity.

**Edit → Delete cargo → Delete this cargo** removes exactly the named whole lot,
with a displayed quantity, zero bank change and recorded reason. Trade goods use
the existing correction operation with zero remaining quantity/basis/goods value.
The original lot and written-off costs remain in the correction audit; active or
amendment-required insurance still blocks direct correction, and ended policies
retain their existing reconciliation. Other cargo retains the original item in a
deletion audit. Neither path is a sale, payment, insurance claim or bulk
normalization. They preserve unrelated lots, supplies, contracts, ledger and cash.
History Undo restores the prior item. Edit/Delete use the same owned asynchronous
save boundary as Add, including stale-state rejection and once-only completion.

### Fractional capacity diagnosis and compatibility limit

A synthetic 65-ton hold containing 5 tons of trade goods and 238 cargo LSS
reproduces the reported 7.38 occupied / 57.62 free and 2.38 after-sale figures when
`roundCargoSpace` is absent or false. In the adopted whole-ton model it reserves
3 tons for those exact 238 LSS, yielding 8 occupied / 57 free and 3 after sale.
Other held cargo can also explain a fractional remainder; a screenshot alone
cannot establish its source.

This candidate does not change that saved compatibility contract. `S.used` is
shared by Sell review, the hold manifest and capacity validation. Rounding only
the labels would contradict what the engine permits, and blindly enabling
`roundCargoSpace` would also change reserve transfers and usable endurance.
A consistent follow-up should offer an explicit, undoable compatibility preview
for legacy reserves: retain exact LSS and history, display the additional reserved
space and any over-capacity state, and adopt the same policy in every hold display
and capacity check. It must distinguish space rounding from the existing batch
consumption rule. Existing bulk normalization already provides an explicit
adoption path, but can affect other fractional cargo too. Removing the Sell
summary is a presentation change, not a claim that this compatibility issue is
fixed. No campaign is silently migrated during rendering or loading.


### GM-added cargo receipt

Audit identifies GM-added cargo from retained manual/referee provenance. Its
receipt shows the recorded purchase price and remaining costs, acquisition facts
and an explicitly derived paid/retail comparison. The original recorded retail
basis is used when present; otherwise the reference is explicitly today's current
retail, never invented historical retail or a generated roll. Missing purchase
history remains unknown. Inapplicable dice, negotiation modifiers and availability
fields are omitted for manual cargo. Generated purchases retain their detailed
price/availability evidence in a disclosure. Existing sale records, corrections,
lot ID, recorded fees and acquisition notes remain available; empty sections are
omitted. Optional GM acquisition location/date does not move the ship, change the
campaign clock, debit cash or backdate a ledger transaction.

Manual acquisition location/date remain Not recorded unless explicitly supplied;
the automatic addition world/time is shown separately in Record details. It is
not evidence of when or where previously owned cargo was actually acquired.


### Approved workflow consolidation

Cargo's trade rows now show commodity, a distinct description when useful, tons,
recorded price paid, Edit and Details. Optional insurance stays available. Other
cargo's explicit whole-lot sale is available from Details. Sell rows show the
selection, tons, sale quantity, recorded price paid and current offer; one primary
Find buyer / Review sale action follows the current buyer state. Fees, warnings
and final proceeds remain in the commit review. Manage cargo links back to Cargo.

Add and Edit share commodity, description, tons and price-paid presentation, with
live current retail, derived percentage and price-times-tons reference. Existing
commodity and historical purchase quote are read-only on Edit: a different
commodity requires Add; unknown purchase price stays unknown. Editable remaining
goods cost and fee-inclusive total cost remain explicitly separate in More
details. The reference total does not overwrite those amounts, cash or a frozen
quote. This is a deliberate accounting boundary, not a hidden missing field.
