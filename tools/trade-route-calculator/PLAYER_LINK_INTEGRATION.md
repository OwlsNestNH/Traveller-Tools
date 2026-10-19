# Player links in the regular trade calculator

**Copy Player Link** appears below the ship controls on every main tab. It copies a
read-only snapshot of the selected saved route visit. The caption identifies the
visit number and whether it is current, completed, or not yet visited. Choose a
stop in Overview; Previous/Next follows visit indices, including repeated worlds.
A future stop cannot be exported. A browsed world with multiple possible visits
requires an explicit route-stop selection. Unsaved route previews cannot export.

Current visits use the saved campaign and currently valid session sale quotes at
the instant Copy is pressed. Export never rolls, buys, sells, advances time, or
writes campaign storage. A stale/unpublished local campaign is refused. Clipboard
failure displays the complete URL for manual copying.

New production jumps retain a public departure snapshot in the same candidate
transaction as the jump, before fuel consumption and elapsed time. Failed saves
cannot expose a new capture. The record has a route index, exact departed prefix,
and jump event ID, checked against the active Jump ledger on retrieval. Undo
restores captures together with the campaign; retained audit events alone do not
prove an active visit. Clearing/replanning and later repeats do not substitute an
older same-world capture. Replanning future legs preserves completed prefixes.

Older saves have no complete departure captures. Those completed visits explicitly
report unavailable; the tool does not reconstruct partial history as a complete
snapshot or substitute current data. Capture failures do not block valid travel:
that visit remains explicitly unavailable. Subsequent supported departures work.

## Data boundary and interpretation

- `js/player-campaign-snapshot.mjs` is a reusable read-only browser engine adapter.
  `campaignPlayerSnapshot(state, core, session)` projects current public data;
  `playerSnapshotForVisit(state, core, index, session)` selects a current or saved
  departure. Neither knows about DOM, storage, network, clipboard or URL encoding.
- `js/player-snapshot.mjs` validates and freezes the explicit public contract.
  `js/player-snapshot-link.mjs` builds and budgets the actual Pages URL using the
  separate codec. No raw campaign object is serialized into a link.
- The allowlist includes world/UWP/trade codes/zone/starport, ship name/cash,
  fuel in all tanks including bladders, internal LSS and overflow, cargo,
  current offers, and public expense aggregates. GM reasons, descriptions,
  notes, audit rolls, private settings and counterparties are excluded.
- Held trade lots use their recorded remaining goods cost and original unit
  purchase price/base. Purchase percentage is that original ratio displayed to
  0.01%, before link rounding; stale generated audit percentages are not used.
  Goods cost excludes fees/insurance. Separate lots remain separate. Other cargo
  and accepted freight/mail are anonymous Other rows with unknown purchase costs.
- Buy offers follow existing purchase availability: saved offers at the actual
  world remain usable across visits until expired, exhausted or rejected. Manual
  unresolved prices are omitted. Sell offers require the current world and exact
  current revision. Preparing a jump invalidates previous sale-quote revisions,
  so departure snapshots commonly show sell offers as not checked. No new quote
  is generated for sharing.
- Expense plans are not saved per visit, so expected amounts remain Unknown.
  Paid amounts use a verified current-visit ledger boundary and reconciled bank.
  Ship/manual expenses are categorized; maintenance, other ship/manual expenses,
  broker fees, tax and insurance payments are incidentals. Unverified histories
  show Unknown rather than zero. GM expense notes are excluded.
- Internal LSS days require a known positive consumption complement. Missing
  tracking stays Unknown. Exact rational LSS is represented at the existing
  six-decimal display precision. Cargo reserve space uses whole physical tons computed from the exact balance.
  Fractional balances too close to a whole-ton boundary to preserve that space
  at snapshot precision are explicitly refused, never understated.

## Limits and isolation

The existing codec preserves supported legacy versions 1–4 and writes codec 5.
Costs round upward to Cr100 for production links, disclosed in both operator and
viewer UI; paid unit and lot amounts round independently. There is no hosted
backend, SQL, paid service, live synchronization or automatic transmission.
Anyone holding the URL can read its public snapshot; links are not authenticated,
encrypted or revocable, and the recipient must request a new link after changes.

The full deployed URL is limited to 8,192 characters. Invalid Unicode, unsupported
numeric ranges, more than 200 rows in a section, fractional cargo-hold tons and
negative cash balances are refused clearly. No rows are silently omitted to fit,
and HTML-file delivery is not substituted. Historical captures can remain
unavailable when their source cannot satisfy this contract. Browser or messaging
software may impose a smaller practical URL limit.

The recipient page has no production campaign imports or transaction controls.
It only uses the separate `traveller-player-snapshot:v1:` namespace for its last
snapshot and optional local Other annotations; it never reads/writes/imports the
recipient's saved campaign. Rendering uses inert text, validates each navigation,
and handles malformed/incompatible links safely. The nearby-world reference uses
public Traveller Map data independently of saved campaign data.

## Verification

`player-campaign-snapshot.test.mjs` exercises public projection, exact purchase
provenance, full-path encoding, repeated visits, pre-jump fuel, Undo/recommit,
clear/recreate, future replanning, legacy/unavailable records, malicious imported
payloads, active offers, paid expenses, known/unknown LSS, size failures and
clipboard/no-write integration.

`player-link-browser.test.mjs` runs the actual production app at 1440, 390 and
320 px with successful/denied clipboard access. It selects repeated visits,
performs a real jump, reloads its capture, and opens recipients through browser
history while checking campaign bytes remain unchanged. Existing snapshot tests
cover hostile payloads, versions, repeated use, annotations and storage failure.
All fixtures are synthetic. Live Traveller Map access is blocked in this cloud
environment; browser map responses are mocked.
