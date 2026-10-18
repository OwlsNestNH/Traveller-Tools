# Player snapshot: first-stage review

This standalone screen uses synthetic fixtures only. Open `player-snapshot-preview.html`
through a static HTTP server from this folder. It is intentionally not linked from
the production tool. Review the section order, wording, useful fields and mobile
layout before any production integration. This is one informational page, with
vertical scrolling when needed, not multiple tabs or a transaction interface.

[Desktop screenshot](verification/player-snapshot-review/desktop.png) ·
[Mobile screenshot](verification/player-snapshot-review/mobile.png)

## Separation and contract

- `js/player-snapshot.mjs` is the headless version-1 data contract and allowlist
  projection. It returns a detached, deeply frozen value. It has no imports,
  DOM, storage, transaction, networking or URL dependencies.
- `js/player-snapshot-view.mjs` renders that contract using text nodes. Invalid
  input replaces the old display with a safe error. Unknown versions fail closed.
- `js/player-snapshot-fixture.mjs` is synthetic review data. The separate preview
  bootstrap loads it directly; it ignores URL query/fragment data entirely.

The contract contains capture/campaign dates; public world name, location, UWP,
trade codes, zone and starport information; ship name, cargo capacity, current
fuel and planned destination; separate cargo lots; buy/sell quote name, tons and
Credits per ton. All amounts are nonnegative decimal strings, with at most 15
integer and 6 fractional digits. Each list allows at most 200 rows, and each text
field at most 240 UTF-16 code units. These are defensive contract limits, **not a
validated share-link budget**. Quote states distinguish available (including
checked-empty), not checked and expired. Quoted quantities do not imply capacity,
affordability or permission to transact. Capture time is an operator-supplied
label; the preview does not calculate quote expiry.

GM audit/reason fields, financial ledger, bank balance, hidden rolls, raw campaign
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
