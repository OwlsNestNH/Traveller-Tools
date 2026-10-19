# Standalone snapshot codec prototype

`js/player-snapshot-codec.mjs` is separate from the headless projection and renderer.
The codec accesses no storage, DOM, networking or campaign transactions. Separate
standalone generator/viewer modules now exercise its URL round trip. No production
share button, short path, hosted storage, two-link assembly or HTML-file fallback is added.

The proposed prefix `https://owlsnestnh.github.io/Traveller-Tools/p#` is **47 characters
and UNDEPLOYED**. The codec measurement prefix is not a working route; the full standalone Pages routes are published. The standalone generator
instead uses the actual same-server `player-snapshot-preview.html` path. Both encoding and decoding default to an 8,192-character safety limit. Links have variable length; 200 characters is no longer a product target. Encoding
reports required/allowed length and rejects oversize input without truncating rows.
Explicit smaller budgets are available for diagnostic rejection checks. The standalone viewer validates fragment data on initial load and hash navigation,
rejecting actual URLs over 8,192 characters. Invalid links replace stale content.

## Current whole-ton and life-support contract

New links use codec 3 / contract 3. Cargo lots (including Other) and cargo capacity
must be canonical nonnegative whole-ton strings. Fractional inventory is never
rounded. Old codec-1/2 links with fractional cargo show a clear fresh-snapshot
message, replace stale content and do not write recipient storage. Their saved
records remain untouched, including when restoring the last opened snapshot.
Old whole-ton links remain readable; missing duration/reservation values are unknown.

Life support carries explicit `daysRemaining` and `daysCapacity` for **internal**
supplies at the snapshot's crew/passenger consumption. The display uses days and a
fill bar when both are known. It does not divide LSS stock by an assumed occupancy.
The synthetic example explicitly supplies 21 / 100 internal days, based on
168 / 800 internal LSS at 8 LSS/day. Unknown days display clearly with no fill bar.
Fuel quantities and exact stock/cash/market quantities retain their previous precision.

Positive cargo LSS is shown separately as “Life support overflow · reserved space”.
`cargoReservedTons` is an explicit whole-ton reservation; `cargoLss` preserves exact
physical stock. The production rule inspected read-only is 100 LSS per physical
ton, with whole-space reservation rounding up when enabled (`life-support.mjs`
`supportCargo`). Thus 150 exact LSS reserves 2 tons, not 200 LSS. The contract checks
known reservation values against this rule. Missing reservation values stay unknown;
no legacy inventory or production setting is migrated. The reservation is separate
from trade lots and is not added to an existing total or to internal days.

Current Cr100 full Pages-path measurements, retaining three buy and three sell
offers and the new LSS fields: **275 characters for 10 cargo lots; 281 for 12**.
Earlier measurement tables below are historical codec-2 fixtures with fractional
sample cargo and no explicit days/reservation fields; rerun the measurement script
for current values. Sample changes create fresh synthetic data, not converted inventory.

## Public contract and protocol

The first bytes identify magic 80, codec 3, snapshot contract 3, immutable catalog 1
and flags (bit 0 selects Cr1000 instead of Cr100; bit 1 enables percentage prices). Codec 1/2 whole-ton links remain readable with unknown duration/reservation fields; fractional cargo links reject explicitly. Other unknown versions fail closed. Versioned
commodity names, synthetic world fields and shared public display fragments are
frozen in `player-snapshot-catalog.mjs`; existing IDs must never be repurposed. A wire
fingerprint regression test guards this prototype mapping. Production-wide stable
planet IDs/catalogs are not implemented: only the clearly synthetic example world
has a reference; other worlds are carried inline. Every differing world field is
encoded explicitly, including GM-approved public overrides.

Fields follow contract order, with explicit counts for lists, string tokens and
inline UTF-8 byte strings. Unsigned canonical varints encode integers. Decimal
scale and mantissa preserve physical quantities and cash exactly, including trailing
fractional zeroes. Costs (expense expected/paid and offer unit prices) round UP to
Cr100 by default or explicitly Cr1000, using BigInt arithmetic. Null has a separate
marker from known zero. The original object is never changed. Expense basis text
is preserved verbatim; explanatory rates in that text remain explanatory source
text, whereas the displayed numeric expected/paid and offer prices are quantized.
The decoder returns the validated, deeply frozen public contract.

For canonical commodities, the encoder also tries exact percentages of immutable
base prices, in 5% units. This means quoted unit price divided by that catalog
base, not a dice-roll modifier or a fee/tax calculation. Only exact equivalents
after approved rounding qualify. A tagged explicit-price escape preserves Other,
overrides, caps/settings or unusual quotes that do not qualify. It selects the
percentage packet only if the entire packet is smaller, so this optimization never
increases the link. Cargo, buy and sell remain separate lists; ownership is never
inferred from a buy/sell flag. The decoder rejects percentages inconsistent with
the declared rounding. The 4 cargo / 50 buy / 50 sell canonical comparison reduces
498 bytes / 711 characters to 458 bytes / 658 characters at Cr100. The mixed examples
below remain unchanged because explicit prices are already smaller.

Unknown/custom commodity names map to reserved ID 0, Other. Quantities, prices,
list direction, ordering and individual lots remain separate. Local recipient
labels are not in the packet and do not rename the operator's goods.

Amounts allow at most 15 integer and 6 fractional digits. If upward rounding would
exceed that range, encoding explicitly rejects rather than wrapping or clamping.
At most 200 rows per list, 240 UTF-16 code units per text field, 65,536 binary bytes
and 100,000 explicitly configured URL characters are accepted. These are defensive
limits, not safe messaging-app transport guarantees. Malformed UTF-8, lone encoder
surrogates, excessive/noncanonical varints, unknown IDs/enums, truncation, trailing
bytes, noncanonical base64url and invalid final contract data reject safely.

The packet is not signed, encrypted or authenticated. A valid modified payload can
represent altered public values. Validation prevents unsafe structure/rendering;
it cannot prove an operator authored the data. No GM-only fields are serialized:
projection reconstructs its allowlist before encoding, but a future adapter must
still deliberately select public content rather than inserting referee text into
approved public string fields.

## Historical codec-2 measurements

Run `node verification/player-snapshot-measure.mjs`. Current output includes the full
47-character proposed prefix, all current public fields and expense explanations.
The larger fixtures vary quantities, prices and canonical/custom commodity names.
Custom names become Other by the approved rule. No rows are discarded.

| Cargo / buy / sell rows | Cr100 bytes | Cr100 URL characters | Cr1000 bytes | Cr1000 URL characters |
| --- | ---: | ---: | ---: | ---: |
| 4 / 3 / 3 | 112 | 197 | 108 | 191 |
| 0 / 0 / 0 | 79 | 153 | 77 | 150 |
| 50 / 50 / 50 | 677 | 950 | 647 | 910 |
| 200 / 200 / 200 | 2,630 | 3,554 | 2,600 | 3,514 |

The full synthetic ten-row fixture fits 200 with this proposed prefix. Adding one
one-ton Other cargo lot gives 199 characters at Cr100; adding two gives 202 and
rejects. At Cr1000, three extra such lots give 199; four give 202. These are fixture
measurements, not universal capacity guarantees. Custom worlds, text, overrides,
quantities and prices change capacity. No required fields are dropped to fit.

## Ten and twelve cargo lots

The generator offers 10 or 12 actual cargo lots (default 12), plus the original
four-lot example. Repeated commodity IDs remain separate ordered lots with their
own quantities. A bounded list count frames cargo, buy and sell independently;
extra begin/end characters are unnecessary. Every other current field and all
three buy plus three sell offers remain present. Both rounding modes round-trip
the complete prepared contract, and browser tests count the rendered cargo rows.

| Cargo lots (plus 3 buy / 3 sell) | Rounding | Bytes | Proposed short URL | Full Pages-path URL |
| --- | ---: | ---: | ---: | ---: |
| 10 | Cr100 | 133 | 225 | 281 |
| 10 | Cr1000 | 129 | 219 | 275 |
| 12 | Cr100 | 139 | 233 | 289 |
| 12 | Cr1000 | 135 | 227 | 283 |

These full URLs include their respective prefixes. Neither Pages preview path is
deployed in this task. The full path measured is
`https://owlsnestnh.github.io/Traveller-Tools/tools/trade-route-calculator/player-snapshot-preview.html#`.
The generator uses the actual server URL and a fresh timestamp, so its measured
length can differ. Custom world/text cases remain longer; all data must fit the
safety limit or the generator rejects clearly without dropping lots.

The original 197/191 result benefits from sample-specific Port Meridian world and
New Dawn destination references. No ship name, cash balance, cargo quantity or
quoted price is baked into the dictionary. A different synthetic Copper Kestrel /
Greyhaven / Haven case with changed cash, fuel and cargo quantities measures
339/334 characters; custom visit and berth prose raises it to 489/483. All four
variants passed exact prepared-contract round trips. These comparisons use the
same proposed short prefix; 197 is not a general campaign capacity claim.

## Verification

`node --test verification/player-snapshot.test.mjs verification/player-snapshot-codec.test.mjs verification/player-snapshot-storage.test.mjs`
checks immutable allowlisting, round trips after approved quantization, exact cash
and quantities, Unicode/markup, world overrides, incompatible versions, truncation,
limits, maximum distinct lots, hostile byte mutations and the stable wire format.
`verification/player-snapshot-browser.test.mjs` checks inert presentation, local
Other-label isolation, repeated use, navigation and saved-campaign storage isolation.
`verification/player-map-preview-browser.test.mjs` tests the separate reference preview.
Browser suites accept `TRAVELLER_BROWSER_EXECUTABLE=/usr/bin/chromium` for local runs.

## Run the working prototype

From the repository root:

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory tools/trade-route-calculator
```

Open `http://127.0.0.1:8765/player-snapshot-generator.html`, generate a synthetic
example, and follow **Open player snapshot**. The test screen defaults to 12 actual cargo lots and the 8,192-character safety
limit; selecting 200 demonstrates safe rejection. It stamps
a fresh capture time and uses the real current-server preview path. One local run
of the original four-lot fixture produced a **203-character** working URL at Cr100; exact length varies with hosting
prefix. A link to localhost is usable only on that same machine, not a public
preview deployment. The draft PR/source and screenshots are remotely reviewable.

The viewer has no transaction controls. Its Other popup offers Unknown independently
for name and local base price. Zero remains a known zero; estimates are visibly
labelled and never replace known transmitted quotes. A cargo lot without a quote
still has no quote after a base estimate. This codec always transmits authoritative
prices for offers (including Other); it does not infer a missing quote from a
player-entered base or silently create one. Recipient snapshots and annotations now persist in a dedicated browser namespace,
separate from campaign saves. Reopening an old link restores its own annotations;
opening a new link creates a separate record and does not update an existing view.
Opening the viewer without a fragment restores the last opened recipient snapshot.
A blocked/full store leaves the snapshot usable and displays a warning. Clearing
browser data removes retention; storage does not synchronize across browsers/devices.

[Synthetic generator](verification/player-snapshot-review/generator.png) ·
[Decoded desktop](verification/player-snapshot-review/decoded-desktop.png) ·
[Decoded phone](verification/player-snapshot-review/decoded-phone.png) ·
[Other popup](verification/player-snapshot-review/other-popup-phone.png).

## Static references and exact derivation

Codec 1 preserved the complete prose contract in 252/248 bytes (383/378 URL
characters). Codec 2 preserves the same contract after the approved cost rounding
in 112/108 bytes (197/191 characters), saving 140 binary bytes in this fixture.
Earlier 213/207-character estimates used a different normalized experimental model;
they are historical estimates, not the current implementation.

| Field group | Codec 1 bytes, Cr100 | Codec 2 bytes, Cr100 | Representation |
| --- | ---: | ---: | --- |
| Header | 5 | 5 | Explicit versions and flags |
| Capture/campaign labels | 38 | 11 | Exact recognized format plus numeric date/time |
| World | 2 | 2 | Immutable reference and override mask |
| Ship/resources/cash/destination | 51 | 29 | Exact decimal values; known destination reference |
| Visit label | 34 | 3 | Derive matching world/year; carry day bounds |
| Expenses and basis | 79 | 24 | Five exact canned-text references; numeric fuel basis |
| Cargo | 13 | 10 | IDs and compact exact decimals |
| Buy/sell status and rows | 30 | 28 | IDs, quantities, quantized authoritative quotes |
| Total | 252 | 112 | All contract fields retained |

References apply only to exact known text. Recognized capture, campaign and visit
formats reconstruct byte-for-byte; differing visit years are carried explicitly.
The fuel explanation carries its exact decimal quantity/rate, including trailing
zeroes. Unrecognized dates, custom labels, explanations, destinations and overrides
use raw UTF-8 fallback without normalization. Static templates are codec-2-specific;
existing catalog IDs and codec-1 decoding remain unchanged and regression tested.
Physical quantities and cash use a combined mantissa/scale varint, preserving null,
known zero and trailing fractional zeroes. Recipient annotations never enter links.

## Recipient storage boundary

`player-snapshot-storage.mjs` uses only keys beginning
`traveller-player-snapshot:v1:`. Each record is keyed by the exact validated canonical
payload; the separate `last` key points to the most recently opened payload. Records
contain that original payload plus separately validated local annotations keyed by
list and row index. No storage enumeration, campaign key read/write, import, engine
mutation or storage-event synchronization occurs. The immutable snapshot is decoded
again on restore. Stored annotation records are bounded, version checked and fully
validated before any labels are accepted; unknowns remain null, while zero remains
a decimal string. Corrupt annotations cannot change transmitted numbers or rename
known catalog goods. There is no automatic eviction: quota failures are disclosed
instead of silently deleting old snapshots. The no-link synthetic example alone
remains a transient demonstration until a generated link is opened.

Production integration, cross-device synchronization and a retention-management
screen remain deferred; **recipient persistence itself is now implemented**.
