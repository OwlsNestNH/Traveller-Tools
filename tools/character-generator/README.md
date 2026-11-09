# Traveller character generator (source-assisted Beta 0.1)

Original, non-commercial source-assisted beta (`0.1.0-beta.1`). This is **not a complete, fully automated or rules-certified generator**. Some paths stop for source-book adjudication and unsupported consequences still need separate referee bookkeeping. See the [user-facing changelog](../../changes/character.html) for Beta 0.1 coverage and limitations. Merge and deployment require the exact-candidate tests and independent review in COVERAGE.md.

## Release scope

The released choices are Human, Aslan, Vargr and Aezorgh, with Core and Companion paths. Zhodani species, nine careers, and the Intendant/Noble PSI option are deferred. They are absent from both public API transports and selectable UI choices. Human optional PSI, Core/Vargr Psion and Companion education remain available.

The complete development implementation is preserved for future work. `api` is the supported release contract; `developmentApi`, direct procedures and the verification-only development server are internal test interfaces, not alternate released entry points. There is no query, request or environment switch to enable deferred choices. This is product scope, not protection against someone modifying this local open-source program.

## Run locally

Node.js 22 or newer; no runtime dependencies.

```sh
node tools/character-generator/server.mjs
```

Open `http://127.0.0.1:8781/?api=local`. The server listens only on loopback and provides the separate JSON rules API. `PORT` can select another local port. A static server can instead serve this directory: without `?api=local`, the same API adapter runs the rules module in the browser. HTTP mode does not download the engine modules during normal UI use; static mode loads them on demand. No account or cloud save is used. Local runs make no visit-counter requests. On the published site, the existing shared Hits counter receives only the canonical tool path, never character data, query strings or fragments. Counter failures do not affect generation.

## Design

- `engine/catalog.mjs`: source identifiers, species, careers, and labels.
- `engine/core-pack.mjs`, `expansion-pack.mjs`, `education-pack.mjs`: original numeric rule representations with source-page references.
- `engine/core-procedures.mjs`: pure procedures for ageing, injuries, benefits, medical bills, and pensions.
- `engine/companion-education.mjs`: pure, source-referenced Companion admission and award rules.
- `engine/benefits.mjs`: source-keyed material-benefit and pension procedures.
- `engine/psionic-games.mjs`: pure competition procedures, with bounded current-career session integration tracked in COVERAGE.md.
- `engine/aslan-access.mjs`: bounded outward career rights, history restrictions and typed source timing conflicts, without changing upbringing.
- `engine/aslan-land.mjs`: current-SOC parcel calculation, delayed claims and explicit actual-claim confirmation, separate from family inheritance.
- `engine/clan-share-assets.mjs`: source-derived male art and explicitly referee-confirmed weapon bundles, separate from cash or resale.
- `engine/clan-shares.mjs`: exact share-lot accounting and validated exchange plans; session commands preserve source and clan provenance.
- `engine/aslan-origin.mjs`: source-referenced family, birth, estate-baseline, clan and pride procedures with separate identity and explicit referee boundaries.
- `engine/aslan-outlaw-restoration.mjs`: distinct male/female Outlaw restoration and explicit single-attempt historical career-access rulings.
- `engine/aslan-officers.mjs`: source-bound officer offers, eligibility, rank mapping and unconverted Clan Share forfeiture.
- `engine/assignment-changes.mjs`: Core assignment classification and source-backed career re-entry rules.
- `engine/cross-career-procedures.mjs`: borrowed Zhodani table/training procedures, immediate advisory cash and explicit one-roll benefit credits.
- `engine/merchant-fine.mjs`: original typed fine/payment procedure for the Zhodani Merchant mishap, with a separate recorded link to any subsequent re-education.
- `engine/zhodani-reeducation.mjs`: pure source-referenced treatment plans and typed referee decisions, with separate non-career time and ageing integration in the session engine.
- `engine/psionics.mjs`: pure source-referenced potential and talent-acquisition checks.
- `engine/audit.mjs`: deterministic before/after mechanical audit detail.
- `engine/session.mjs`: deterministic state transitions and the versioned API. No DOM dependencies.
- `gui/client.mjs`: interchangeable in-process or HTTP API transport.
- `gui/app.mjs`, `index.html`, `styles.css`: accessible, large-control interface and live character sheet.
- `server.mjs`: local HTTP adapter. Not an authenticated production service.

See API.md for the request/response contract and COVERAGE.md for the boundaries of automation.

## Requested options

0-6 boon rolls, score placement/swapping, optional minimum-total rerolls, and optional extra characteristics. These switches are explicitly identified as optional or house rules. Extra characteristics and species modifiers are excluded from the threshold. Boons apply to the first N rolls before allocation.

Standard Aezorgh use a raw-dice minimum of 30, with swaps within their one-die group and separately between DEX/INT; GM mode permits exceptions. Other species use 43 and can swap any of their six raw scores. The optional Aezorgh 2D6 method rolls all six characteristics with 2D6 and checks 43 against those raw totals before placement, halving or bonuses. Any raw totals may be swapped. After placement, STR/END/EDU/SOC are divided by two and rounded down, then species bonuses apply. A boon rolls 3D6 and retains the best two before division. This house option preserves the destination characteristic formula; it is not a published JTAS generation method. General division rounds down under Core 2022 p. 6.

PSI is absent until tested or generated by a species rule. Optional human PSI generation requires GM mode. The preserved Zhodani Intendant/Noble option is deferred and is not selectable in this release. Native ordered training records every talent choice and check penalty; institute access, payment and timing require an explicit referee decision. Species-specific social and psionic rules are separate from optional human characteristics.

At the end of a Core career term, the eleven careers explicitly listed on Core p. 20 offer an assignment change. Retained-rank changes begin the next term after the check; restart paths collect benefits and then requalify at rank 0. Historical term assignments remain visible and printable. Alien and unclassified careers do not silently inherit these rules.

The action log is always on. GM edits require a reason and keep the old result. Restoring or replacing an old result requires GM mode and appends an action; it does not erase history or rewind the random sequence. Save files include that history. This is a local audit trail, **not cryptographic proof, hidden randomness, or protection against a person rewriting their own file**.

## Data and saves

The browser stores one draft locally. Unsaved biography text survives ordinary UI rerenders and is recorded before JSON export or the Print button. It is not saved merely by typing; the browser warns before unloading a dirty draft. Use **Save character & log** for backups before starting a new character. Import replays and validates the file before replacing the current draft. Unreadable stored drafts are preserved behind recovery controls, with raw backup download and explicit replacement confirmation. New characters use rules revision `character-preview-2026-11-09.17`. The verified compatible `.16` revision remains editable without changing its saved revision, events or historical escape outcomes; prior `.2`, `.3`, `.4`, `.5`, `.6`, `.7`, `.8`, `.9`, `.10`, `.11`, `.12`, `.13`, `.14` and `.15` saves are available only through read-only recovery. New saves record an explicit rules revision as well as save format 1. Only current or explicitly supported compatible revisions within the current release scope can be replayed. Zhodani saves still enter read-only recovery without rewriting their bytes, commands or audit history. Older development exports without a revision, and files from any unsupported rules revision, are rejected before character reconstruction. This prevents historical outcomes from silently changing when rules are corrected. The recovery panel can display their recorded actions as an unverified, read-only history and download the unchanged original file; it cannot reconstruct a validated character or continue that historical session. Invalid UTF-8 files are not imported, and their original File bytes remain downloadable. A malformed browser draft remains protected until explicit replacement. Keep exported backups when updating versions. No automatic migration or guessed historical rules are used.

No licensed books, scans, private document links, or borrowed Tremlas code are included. Own the relevant books to resolve source-assisted steps. Character names, notes, and campaign material stay in your browser or local API request and are not sent to the publisher, repository or visit counter.

## Verification

All existing engine tests and the full 45-career development smoke remain in CI. Release API tests separately verify 36 selectable careers and four species. Deferred browser scripts (games, reeducation, merchant-fine, zhodani-choice and cross-career) use `verification/development-server.mjs`; they are retained development coverage, not release acceptance. Mixed expansion/transfer scripts use that server only for Zhodani scenarios and the release server for Companion, Vargr and other supported cases. The release-scope browser suite checks both static and HTTP transports at desktop and 320px widths, including byte-identical rejected-save recovery. No original test is skipped or deleted.


```sh
node --test tools/character-generator/verification/*.test.mjs
node tools/character-generator/verification/survival-result-browser.mjs /path/to/playwright
node tools/character-generator/verification/advancement-result-browser.mjs /path/to/playwright
node tools/character-generator/verification/life-event-presentation-browser.mjs /path/to/playwright
node tools/character-generator/verification/training-information-browser.mjs /path/to/playwright
node tools/character-generator/verification/release-presentation-browser.mjs /path/to/playwright
node tools/character-generator/verification/release-scope-browser.mjs /path/to/playwright
node tools/character-generator/verification/browser.mjs /path/to/playwright
node tools/character-generator/verification/review-browser.mjs /path/to/playwright
node tools/character-generator/verification/expansion-browser.mjs /path/to/playwright
node tools/character-generator/verification/benefit-browser.mjs /path/to/playwright
node tools/character-generator/verification/games-browser.mjs /path/to/playwright
node tools/character-generator/verification/aezorgh-browser.mjs /path/to/playwright
node tools/character-generator/verification/recovery-browser.mjs /path/to/playwright
node tools/character-generator/verification/transfer-browser.mjs /path/to/playwright
node tools/character-generator/verification/reeducation-browser.mjs /path/to/playwright
node tools/character-generator/verification/merchant-fine-browser.mjs /path/to/playwright
node tools/character-generator/verification/zhodani-choice-browser.mjs /path/to/playwright
node tools/character-generator/verification/cross-career-browser.mjs /path/to/playwright
node tools/character-generator/verification/assignment-browser.mjs /path/to/playwright
node tools/character-generator/verification/aslan-officer-browser.mjs /path/to/playwright
node tools/character-generator/verification/aslan-restoration-browser.mjs /path/to/playwright
node tools/character-generator/verification/aslan-outlaw-browser.mjs /path/to/playwright
node tools/character-generator/verification/aslan-origin-browser.mjs /path/to/playwright
node tools/character-generator/verification/clan-share-browser.mjs /path/to/playwright
node tools/character-generator/verification/clan-asset-browser.mjs /path/to/playwright
node tools/character-generator/verification/agent-cover-browser.mjs /path/to/playwright
node tools/character-generator/verification/source-training-browser.mjs /path/to/playwright
node tools/character-generator/verification/career-smoke.mjs
```

Browser checks require Playwright and an installed browser. Set `CHARACTER_BROWSER_CHANNEL=msedge` to use installed Microsoft Edge. Browser contexts are temporary and do not use an existing signed-in profile. Screenshots and results go to ignored `verification/artifacts/`.

## Adding species and careers later

Keep source data in a separate rules pack and register its identifiers in `engine/catalog.mjs`. Use the existing effect schema for shared mechanics; add a tested handler for genuinely new procedures. A new label or table does not establish complete support. Unknown effects must stop explicitly with a source reference.

Each addition needs source-page provenance, species/culture eligibility tests, deterministic save/replay regressions and narrow-screen UI checks. Bump `RULES_REVISION` whenever engine or rule data changes can alter results, continuation or audit semantics; never stamp an older save with a newer revision to make it load. Keep optional rules distinct from defaults and preserve the always-on audit. Review publication rights before distributing a new source pack.

## Rights and attribution

Traveller belongs to Mongoose Publishing. The site operator reports that Mongoose is aware of the site and handles publisher correspondence. Distribution remains subject to the publisher policy; this is not publisher endorsement or a licence to the underlying books.

The interface takes inspiration from the step-by-step flow of [David Vines' character creator](https://blog.tremlas.com/games/traveller/mongoose-v2-character-creator/). Its code, text, styling, and assets were not copied. The [plugin author's redistribution restrictions](https://blog.tremlas.com/wordpress-plugins/mongoose-traveller-v2-character-creator-plugin-details/) remain separate from rights in this original implementation.

The prescribed notice is available in [NOTICE.html](NOTICE.html) and must remain with the tool.

Review [Mongoose's licensing page](https://www.mongoosepublishing.com/pages/traveller-licensing) and its linked fair-use policy. Speciality suggestions are restricted by the same pending-award eligibility checks as the engine. Open-ended subjects, languages and professions can still be entered within the awarded base skill. Training choices offer alphabetical, deduplicated skill and characteristic names, without dice-to-result mappings, row order or weights. The ordinary UI does not display full tables or copied book explanations. Its original executable numeric mappings remain readable in source files. Neither a public repository nor static hosting provides source confidentiality; the localhost adapter also serves those files for static-mode compatibility. Avoid claiming that labels-only screens make the underlying rule data inaccessible.

## Source-assisted beta boundary

Normal automated paths and typed decisions retain their source, checks and mandatory action log. Generic book steps are manual: only supported effects entered there are applied. Future modifiers, permissions and other unsupported consequences must be tracked separately with the referee. Confirming a note does not implement those rules. Preserve exported files before updates; older rules revisions open only through unchanged-byte recovery.

## Result presentation

A shared, read-only result panel names each roll and its recorded effects across supported career/species paths. Advancement and survival checks show verified success/failure, while secondary rolls retain their labels and totals. The character sheet keeps current rank, injuries, recorded medical notes, ongoing modifiers and entitlements visible. Proposed treatment and source-assisted consequences are marked pending, not applied. Core life-event titles and Vargr Good Fortune are named; other expansion results retain verified table and result identifiers where titles are not sourced. The existing detailed action log and text download are unchanged. These derived display fields do not change rolls, command summaries, saved rules revisions or save compatibility.

## Later-career basic training

The basic-training choice and the regular term training roll are separate in a later career, including Prisoner. The first career alone replaces its initial regular training roll with basic training (Core Rulebook Update 2022, p. 18; Prisoner exceptions on p. 52). The screen names both steps and explains the transition without changing rules, saved events or existing save compatibility.

## Explicit Prisoner escape checks

Prisoner Event 3 names the escape opportunity, its risk, and separate Stealth and Deception 10+ buttons (Core 2022, p. 57). The new `prisoner-escape` command uses exactly the selected skill. The original `choose-effect` command and source table remain unchanged so recorded `.16` escapes replay identically. Compatible `.16` saves can continue interactively and retain their revision and original events. Saves containing the new command require this updated generator; backwards loading into an older app build is not supported. Older or malformed saves and deferred histories retain recovery-only handling.
