# Player snapshot: first-stage review

This standalone screen uses synthetic fixtures only. Open `player-snapshot-preview.html`
through a static HTTP server from this folder. It is intentionally not linked from
the production tool. Review the section order, wording, useful fields and mobile
layout before any production integration. This is one informational page, with
vertical scrolling when needed, not multiple tabs or a transaction interface.

[Desktop screenshot](verification/player-snapshot-review/desktop.png) ·
[Mobile screenshot](verification/player-snapshot-review/mobile.png)

## Separation and contract

- `js/player-snapshot.mjs` is the headless version-4 data contract and allowlist
  projection. It returns a detached, deeply frozen value. It has no imports,
  DOM, storage, transaction, networking or URL dependencies.
- `js/player-snapshot-view.mjs` renders that contract using text nodes. Invalid
  input replaces the old display with a safe error. Unknown versions fail closed.
- `js/player-snapshot-fixture.mjs` is synthetic review data. The separate preview
  bootstrap loads it directly when no fragment is present; shared fragments now
  pass through the separate codec before rendering. Query parameters do not import state.

The contract contains capture/campaign dates; public world name, location, UWP,
trade codes, zone and starport information; ship name, cargo capacity, player-approved cash, main fuel tank amounts,
internal LSS stores/capacity, cargo-stored LSS and planned destination; separate cargo lots; buy/sell quote name, tons and
Credits per ton. Known amounts are nonnegative decimal strings, with at most 15
integer and 6 fractional digits except cargo lots/capacity, which require whole tons; cash, supplies and expense amounts may be null
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

Production adapter and production share button remain deferred; the standalone preview is published on GitHub Pages. A separate headless codec prototype is now implemented;
see [codec results and limits](PLAYER_SNAPSHOT_CODEC.md). The standalone generator/viewer exercises shared snapshots without production
integration and offers no HTML-file delivery fallback. Existing
calculations, save/import paths, Speculative Trade Alpha and Abstract Free Trader
Rules are unchanged. Production trading behavior is unchanged.

## Revised cash, supplies and expenses mockup

Version 2 adds player-approved shipboard cash (Credits), main tank fuel in tons,
explicit internal life-support days and a fill bar. Unknown duration is shown as
unknown rather than inferred from stock or occupancy. Positive cargo-stored LSS
appears separately as whole-ton reserved space with exact LSS stock. The sample
uses 21 / 100 internal days and 150 reserve LSS in 2 reserved tons; reserve stock
is not added to internal days or counted twice as trade cargo. See
`PLAYER_SNAPSHOT_CODEC.md` for whole-ton validation and legacy-link compatibility.

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
the rows. All data remains synthetic. The later local Other-label demonstration is the sole display-editing exception.

## Link and recipient retention

Each GM-generated link opens a fixed information snapshot and retains that
snapshot locally in the player's browser, in storage separate from campaign
saves. Creating a new link must not update an existing recipient snapshot. The
recipient must open the new link to obtain the new snapshot; old links continue
to represent old snapshots. The standalone viewer decodes URL fragments through the codec and retains each
snapshot and its separate local annotations in recipient-only browser storage.
No live synchronization is implemented.

## Historical encoding feasibility measurement

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
limit. This historical measurement preceded the implemented standalone codec, generator and recipient persistence; see current codec documentation.

## Local Other labels and separate map preview

The synthetic preview substitutes unknown commodity names with Other, keeping every
lot separate. Only Other entries expose an on-demand popup for an 80-character local display
name and optional estimated base price, each with an explicit Unknown choice. Labels
are scoped to the exact snapshot plus list and row index and persist with generated
snapshots in a separate recipient namespace. They are not encoded in links, sent
to the GM or synchronized. Known transmitted
quotes stay authoritative; a local base estimate never creates or replaces a quote. Blocked/full browser storage displays a warning; the original snapshot remains usable.
The preview bootstrap does not round the original mockup amounts; codec rounding
is independently tested and disclosed in its API.

## Interactive nearby-world reference

The fresh synthetic example now uses **Regina, Spinward Marches / 1910**. Other ship,
cargo and expense data remain synthetic. An explicit canonical `world.mapReference`
allows the viewer to show the map inline, with an optional separate-page link. Old links retain their original world
and have no inferred map reference: Port Meridian is never silently relocated.

The slider has integer steps 0–6, default 2. Radius 0 shows the snapshot origin only.
Click or keyboard-activate any displayed system for all eight UWP fields in standard
order, readable meanings, trade codes, travel zone, bases, gas giants and allegiance.
Current World restores the immutable origin selection/view without resetting radius.
The compact panel is beside the map on desktop and below it on phones. The SVG fits all selected rings into a fixed panel and recenters when the panel width changes.

`player-map-reference.mjs` contains pure normalization, coordinate and fact helpers.
The UI reuses existing read-only `planet-info.mjs` and `map-territory.mjs`; neither
production module is modified. Political borders/fill use source metadata for every
sector intersecting the covered hexes, including empty neighboring sectors. Missing
coverage is disclosed. Allegiance codes appear on map targets and readable labels
appear in the panel when supplied. Missing facts stay unknown. No importance or
extended report is included.

TravellerMap requests contain only canonical sector/hex or public coordinates,
radius and milieu M1105. Radius and selected system are local view state, never
serialized or stored. The map reads/writes no campaign or recipient storage and
cannot change snapshot cargo, offers, prices, GM overrides or ship location.
Requests have a 12-second timeout, streamed byte limits, bounded rows and stale
response protection. Invalid origins never become reusable anchors on retry.

**Live-source limitation:** this environment's proxy rejects TravellerMap and public
Pages requests with HTTP 403/CONNECT errors. Browser interaction evidence uses
labelled synthetic API responses; it does not certify live source rendering.
[Mocked desktop](verification/player-snapshot-review/map-reference-mocked-desktop.png)
and [mocked phone](verification/player-snapshot-review/map-reference-mocked-phone.png)
show interactions and layout. The live-attempt screenshots show the actual unavailable
state. No invented map is substituted when requests fail.

The focused suite has 38 native tests. Both browser suites cover snapshot navigation,
isolation, all map radii, selection/reset, malformed text, request races, partial
metadata, empty neighboring sectors and invalid-origin retries. Independent review
found the empty-sector edge case, now fixed and regression tested.

## Whole-unit display rounding

Fuel quantities and tank-capacity labels round **down**. Cargo, offers and reserved
space labels round **up** using exact decimal-string arithmetic. LSS stock labels round **down**;
internal days keep their existing presentation. Explicit quantities in expense
basis text follow these rules, while credit rates and LSS consumption rates remain
unchanged. A notice explains that rounded labels may not add up or match costs.
Underlying snapshot data, link bytes, prices, inventory and meter values remain
unchanged. For example 31.5 / 40.25 fuel displays 31 / 40 t while the bar still uses
31.5 / 40.25. No new snapshot link or data migration is needed.

The map footprint follows complete hex rings, with transparent corners and source
territory clipped to those cells. The map stays in its own visible area. The map stays centered on the snapshot origin. Slider input immediately refits the footprint while reference requests load. Selecting a world changes only its detail panel; Current World restores the origin details. Radius remains 0–6 with 0 as origin only.

All radii retain hex numbers, starport letters, UWP, world names and source-backed symbols. Fewer rings enlarge the entire map, including labels and discs. Dense 5–6-ring views, especially on phones, require selecting a world for readable details.

## Always-visible snapshot map area

Snapshots with an explicit canonical reference now show the map directly in a
dedicated, always-visible section of the player screen. The same map page is reused
in a same-origin frame; it receives only public sector/hex identity, never cargo,
prices, annotations or campaign data. Its selected-world panel stays adjacent on
desktop and below on phones. The optional separate-page link remains available.
The frame resizes to its content with a bounded height; observers disconnect on
snapshot replacement, and invalid/legacy snapshots without a reference do not
retain a stale map. All existing read-only and storage boundaries remain intact.

[Inline desktop (mocked map source)](verification/player-snapshot-review/inline-map-mocked-desktop.png) · [Inline phone (mocked map source)](verification/player-snapshot-review/inline-map-mocked-phone.png).

## Map visual revision (draft, 2026-10-19)

Both user-supplied reference images were inspected directly after attachment in the
conversation; earlier Library downloads were blocked by the environment proxy.
The original SVG rendering follows Traveller Map's established world-label layout:
water/dry/unknown discs, naval stars, scout triangles, ringed gas giants, and amber/red
zone arcs. Size-zero worlds show a belt. Capital highlighting comes only from explicit
Cp/Cs/Cx remarks. Other base types retain literal codes rather than guessed symbols.
Political boundaries and shading still come from the existing source metadata engine;
no trade or communication routes are invented or copied from the screenshots.

The complete hex footprint fits a fixed 580px desktop panel (responsive phone height)
at every radius. Panning has been removed by the subsequent approved revision. Touch and wheel gestures scroll the surrounding page normally. No wheel zoom is added: the ring selector controls the fitted scale.

Traveller Map's renderer and symbol table were checked in RenderContext.cs,
RenderUtil.cs and Stylesheet.cs; its source is Apache-2.0, with separate game/data
notices. This revision uses original SVG primitives and existing attributed territory
code, not a copied screenshot or server-rendered image. See licenses/traveller-map-territory-notice.txt.

Validation: 38 focused native tests and both player browser suites pass. Map tests
cover all seven radii at 1100/760/390/320px widths, constant panel height, increasing
disc size with fewer rings, fixed-center selection/reset and normal page scrolling, source-backed symbols and unknown
hydrographics, request failures/races, inert hostile names, and frozen snapshot/storage
isolation. Screenshots use mocked source data; live Traveller Map transport remains
blocked in this environment and is not certified by these tests.

## Cargo values and fixed map candidate

Cargo aboard now shows each separate lot's tons, recorded retail/base Credits per
ton, recorded actual purchase percentage, and paid Credits per ton plus paid lot total for the tons shown. Paid unit/lot costs
follow link rounding; retail and percentage are not reconstructed from those rounded
amounts. Missing provenance, including old links and Other goods, displays Unknown.
Other local estimates cannot fill or overwrite these fields. Desktop uses six
columns; phones show labeled rows per lot. See PLAYER_SNAPSHOT_CODEC.md for codec 5.

The map no longer pans or scrolls internally. The input event immediately refits the
0–6-ring footprint using known worlds while fresh reference data loads; aborted or
stale responses cannot replace a newer selection. World clicks and keyboard selection
leave the center fixed. Wheel/touch gestures scroll the page. Desktop map/control
and world-details panels have equal outer widths and heights, with aligned edges;
phones retain natural stacked panels.

Validation: 42 focused native tests, snapshot and map browser suites, and independent
review. New coverage includes purchase rounding/unknown/Other/legacy round trips,
local-annotation separation, 320–1440px cargo layout, immediate keyboard/input ring
updates during delayed requests, fixed viewBox after clicks/drags, real touch/wheel
page scrolling, and equal desktop panel geometry. Screenshots use synthetic cargo
and mocked map data; no private campaign information is included.
