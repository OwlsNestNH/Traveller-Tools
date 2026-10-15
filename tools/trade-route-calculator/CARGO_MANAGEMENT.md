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
