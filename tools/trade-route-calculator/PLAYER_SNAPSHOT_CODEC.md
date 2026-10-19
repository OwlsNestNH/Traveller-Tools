# Standalone snapshot codec prototype

`js/player-snapshot-codec.mjs` is separate from the headless projection and renderer.
The codec accesses no storage, DOM, networking or campaign transactions. Separate
standalone generator/viewer modules now exercise its URL round trip. No production
share button, short path, hosted storage, two-link assembly or HTML-file fallback is added.

The proposed prefix `https://owlsnestnh.github.io/Traveller-Tools/p#` is **47 characters
and UNDEPLOYED**. The codec measurement prefix is not a working route. The standalone generator
instead uses the actual same-server `player-snapshot-preview.html` path. Both encoding and decoding default to a 200-character total budget. Encoding
reports required/allowed length and rejects oversize input without truncating rows.
An explicit larger budget is available for tests and measurement, not an automatic
fallback. The standalone viewer validates fragment data on initial load and hash navigation,
rejecting actual URLs over 8,192 characters. Invalid links replace stale content.

## Public contract and protocol

The first bytes identify magic 80, codec 1, snapshot contract 2, immutable catalog 1
and flags (bit 0 selects Cr1000 instead of Cr100; bit 1 enables percentage prices). Unknown versions fail closed. Versioned
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
666 bytes / 935 characters to 626 bytes / 882 characters at Cr100. The mixed examples
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

## Implemented measurements

Run `node verification/player-snapshot-measure.mjs`. Each result includes the full
47-character proposed prefix, all current public fields and expense explanations.
The larger fixtures vary quantities, prices and canonical/custom commodity names.
Custom names become Other by the approved rule. No rows are discarded.

| Cargo / buy / sell rows | Cr100 bytes | Cr100 URL characters | Cr1000 bytes | Cr1000 URL characters |
| --- | ---: | ---: | ---: | ---: |
| 4 / 3 / 3 | 252 | 383 | 248 | 378 |
| 0 / 0 / 0 | 214 | 333 | 212 | 330 |
| 50 / 50 / 50 | 860 | 1,194 | 830 | 1,154 |
| 200 / 200 / 200 | 3,029 | 4,086 | 2,999 | 4,046 |

None of these full fixtures fits 200. Even the full fixed briefing with no rows is
333 characters at Cr100, so its realistic row capacity at 200 is zero. Custom
worlds, overrides or unrecognized prose increase the result. Shared display
fragments reduce this particular fixture from an earlier 726 to 383 characters;
this is not a claim of equally good compression for arbitrary campaign wording.

Earlier estimates of 195/198 characters for six/seven rows and 213/207 for ten rows
used a normalized experimental model with typed dates and expense bases. They did
not preserve the full current prose contract and are **not** this implemented
codec's capacity. The result supports evaluating a slightly longer single link;
it does not justify silently sacrificing required information to reach 200.

## Verification

`node --test verification/player-snapshot.test.mjs verification/player-snapshot-codec.test.mjs`
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
example, and follow **Open player snapshot**. The test screen defaults to an
explicit 500-character budget; selecting 200 demonstrates safe rejection. It stamps
a fresh capture time and uses the real current-server preview path. One local run
produced a **397-character** working URL at Cr100; exact length varies with hosting
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

## Why 213/207 became 383/378

The earlier packet was a normalized design experiment, not the full screen contract.
It used numeric dates/visit bounds, a destination ID and typed expense basis fields.
The implemented packet preserves the original labels and complete expense wording,
including text not reconstructible from those few numbers. At Cr100:

| Field group | Earlier design bytes | Full implemented bytes | Difference |
| --- | ---: | ---: | ---: |
| Version/header | 7 | 5 | -2 |
| Capture and campaign date | 8 | 38 | +30 |
| Current world reference | 3 | 2 | -1 |
| Ship, exact resources/cash, destination | 34 | 51 | +17 |
| Visit label / bounds | 6 | 34 | +28 |
| Expense values and explanation/basis | 23 | 79 | +56 |
| Cargo/offer rows and remaining framing | 43 | 43 | 0 |
| Total | 124 | 252 | +128 |

At Cr1000 the corresponding totals are 120 and 248 bytes, again +128. Base64url
rounding plus the same 47-character prefix yields 213 → 383 and 207 → 378. These
figures compare the synthetic fixtures, not arbitrary campaigns or a hard minimum.
The recipient persistence added later does not put annotations or saved browser
records into the link and therefore does not increase encoded size.

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
