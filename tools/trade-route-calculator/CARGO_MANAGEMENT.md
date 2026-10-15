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
undoable transaction. No load/render/import migration runs implicitly.

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
residual. Fill respects whole reserved-space capacity. Refill previews include any
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

## Existing referee entry behavior

“Add existing / referee cargo” already creates a separate speculative lot with
explicit quantity, remaining actual basis including fees/premium, goods purchase
value excluding fees, reason and illegal flag. It does not debit the bank and
does not invent a historical purchase quote. New quantities are currently rounded
up by `state.addLot`; existing fractional quantities are still valid.

Manual transport contracts already offer Freight/Mail/Passengers with quantity,
delivery payment, due days and reason. Passenger selection opens the existing
passenger form with destination, class, whole people, fare/person and accommodation
confirmations, then previews normal boarding accounting. Delivery revenue is not
an acquisition cost. A unified Trade/Freight/Mail/Passenger Add control, optional
typed cost and hundreds/thousands spinner are unresolved and unchanged.
