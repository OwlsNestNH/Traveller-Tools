# Player snapshot: first-stage review

This standalone screen uses synthetic fixtures only. Open `player-snapshot-preview.html`
through a static HTTP server from this folder. It is intentionally not linked from
the production tool. Review the section order, wording, useful fields and mobile
layout before any production integration. This is one informational page, with
vertical scrolling when needed, not multiple tabs or a transaction interface.

[Desktop screenshot](verification/player-snapshot-review/desktop.png) ·
[Mobile screenshot](verification/player-snapshot-review/mobile.png)

## Separation and contract

- `js/player-snapshot.mjs` is the headless version-2 data contract and allowlist
  projection. It returns a detached, deeply frozen value. It has no imports,
  DOM, storage, transaction, networking or URL dependencies.
- `js/player-snapshot-view.mjs` renders that contract using text nodes. Invalid
  input replaces the old display with a safe error. Unknown versions fail closed.
- `js/player-snapshot-fixture.mjs` is synthetic review data. The separate preview
  bootstrap loads it directly; it ignores URL query/fragment data entirely.

The contract contains capture/campaign dates; public world name, location, UWP,
trade codes, zone and starport information; ship name, cargo capacity, player-approved cash, main fuel tank amounts,
internal LSS stores/capacity, cargo-stored LSS and planned destination; separate cargo lots; buy/sell quote name, tons and
Credits per ton. Known amounts are nonnegative decimal strings, with at most 15
integer and 6 fractional digits; cash, supplies and expense amounts may be null
when unknown. Each list allows at most 200 rows, and each text
field at most 240 UTF-16 code units. These are defensive contract limits, **not a
validated share-link budget**. Quote states distinguish available (including
checked-empty), not checked and expired. Quoted quantities do not imply capacity,
affordability or permission to transact. Capture time is an operator-supplied
label; the preview does not calculate quote expiry.

GM audit/reason fields, financial ledger, hidden rolls, raw campaign
objects and unrestricted notes/descriptions have no output fields. Every nested
object is reconstructed from an explicit allowlist. This boundary cannot detect
secret information placed inside an approved name field. A future production
adapter must choose canonical public names and explicitly approved world/ship
fields, and must never pass raw campaign data or referee notes into those fields.

## Validation and deferred work

Run `node --test verification/player-snapshot.test.mjs` and, with a static server
on port 8765 and Playwright installed,
`node verification/player-snapshot-browser.test.mjs`. A system Chromium can be
selected with `TRAVELLER_BROWSER_EXECUTABLE=/usr/bin/chromium`. Existing CI runs
the native suite automatically and the dedicated browser case with screenshots.

Coverage includes GM-field exclusion, immutable projection, numeric and list
limits, malformed data, incompatible versions, hostile markup/Unicode, distinct
empty states, repeat rendering, stale-display replacement, mobile overflow,
back/forward/reload and saved-storage isolation. Desktop/mobile screenshots are
synthetic; no private campaign or credentials are included.

Production adapter, share button, link serialization/decoding, realistic encoded
URL size/Unicode/compression tests, invalid-link presentation and GitHub Pages
integration are deferred until screen review. The preview does not claim to
accept shared snapshots, and offers no HTML-file delivery fallback. Existing
calculations, save/import paths, Speculative Trade Alpha and Abstract Free Trader
Rules are unchanged. No deployment or merge is part of this stage.

## Revised cash, supplies and expenses mockup

Version 2 adds player-approved shipboard cash (Credits), main tank fuel in tons,
internal life-support supplies in physical LSS and separately stated cargo-stored
LSS. Gauges compare known current quantities against known positive capacities.
Unknown values have no fill bar; zero capacity is labelled. Neither physical LSS
stock nor capacity is a count of days. Production's internal LSS capacity is
4 LSS per displacement ton; cargo supplies are separate. No resource calculation
or bank deduction occurs in the preview. Version 1 is explicitly incompatible.

Six fixed expense categories are berth, fuel, salary, mortgage, LSS and
incidentals. Each carries allowlisted expected and paid amounts plus a public
basis label. Null means unknown, distinct from a known zero. Exact decimal
subtotals are calculated headlessly; missing amounts are counted and disclosed.
Expected is the planned total for this stop, including amounts already paid,
not an amount still owed. Paid is actual payments at this stop, not lifetime
spending. A selected salary period and mortgage installment can cover 28 days
even though the visit is shorter; berth covers the stated number of weeks.
The snapshot neither prorates nor synthesizes those payments. The six row basis
labels must be deliberately composed by a future adapter, never copied from GM
notes/audits. Totals remain visible while a native details/summary control toggles
the rows. All data remains synthetic and read-only.

## Later link and retention requirement (not implemented here)

Each GM-generated link opens a fixed information snapshot and retains that
snapshot locally in the player's browser, in storage separate from campaign
saves. Creating a new link must not update an existing recipient snapshot. The
recipient must open the new link to obtain the new snapshot; old links continue
to represent old snapshots. No live synchronization, serialization or local
snapshot storage is added during this mockup stage.

## Bounded encoding feasibility measurement

Measured revised synthetic data with Node gzip; these are not tested browser or
messaging-app limits. Each hypothetical URL uses a 112-character prefix (the
existing preview URL plus `#snapshot=`); the preview does not decode that field.

| Fixture | Compact JSON UTF-8 bytes | Percent-encoded URL characters | Base64url URL characters | Gzip bytes | Gzip + base64url URL characters |
| --- | ---: | ---: | ---: | ---: | ---: |
| Current: 4 cargo / 3 buy / 3 sell | 1,798 | 3,068 | 2,510 | 836 | 1,227 |
| 50 cargo / 50 buy / 50 sell | 11,771 | 20,257 | 15,807 | 2,217 | 3,068 |
| 200 cargo / 200 buy / 200 sell | 43,664 | 74,868 | 58,331 | 6,121 | 8,274 |

Fuller fixtures vary names, lot/quote numbers, quantities and prices and include
Unicode. Repeated vocabulary compresses well; long, less repetitive names may
produce much larger links. The 200-row contract limit per list is not a safe URL
limit. No production serializer, decoder, compression library, link generation
button or recipient persistence is implemented by this measurement.
