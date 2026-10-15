# Cargo management candidate — removal decision required

This candidate implements the independent display portion of the approved Cargo
design: compact separate speculative lots, good name and lot description, exact
tons held, current retail reference, original recorded purchase price, and a Sell
action that opens the existing Trade Sell flow. Accepted freight/mail and other
physical hold use appear separately. Cargo LSS appears only when nonzero; internal
supplies remain on Life Support. No cargo checkboxes appear on the Cargo page.

## Concrete incompatibility with integer remaining controls

Existing saved balances legitimately include fractional tons. Examples already
covered by repository tests include 2.25 t goods, 3.125 t freight, 1.32 t luggage,
a manual 0.125 t luggage total, and 1.015 t cargo LSS. LSS consumption also retains
exact rational quantities. An integer-only remaining value cannot represent
these originals, and one-ton steps cannot reach zero from a fractional original.
The candidate preserves the exact balances. Removal controls and their
confirmation footer are not implemented pending an explicit decision on how to
handle fractional originals. No rounding, fractional disposal, or accounting
exception has been assumed.

Relevant existing rules:

- `amounts.mjs` and `state.mjs` retain exact fractional stored cargo quantities.
- `accommodation.mjs` derives luggage by passenger class or preserves an explicit
  manual quantity; `passengers.mjs` combines booking allowances downstream.
  Removing luggage cannot be implemented by removing passengers.
- `life-support.mjs` uses 0.01 cargo tons per LSS and 4 internal LSS per hull ton.
  `lss-compartments.mjs` preserves explicit internal/cargo compartment allocation.

The eventual removal transition must preserve internal LSS, independent lots and
purchase references; keep previews local; restore on Cancel; and record contract,
mail and luggage loss without delivery or payment. It needs repeated-click,
navigation, persistence-failure and cancellation tests before publication.

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
