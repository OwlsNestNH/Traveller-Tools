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

## Finished character sheet

Finalized Travellers have a large **Open your character sheet** button. This opens a read-only, compact sheet with the current character record, completed terms and concise chronological events and decisions. Saved notes, medical notes and supported species-specific records stay visible. Superseded GM branches remain in the full action log rather than appearing as current outcomes. The sheet offers its own print view, the unchanged character-and-log export, and a separate full troubleshooting-log download. Closing the sheet or pressing Escape returns to the finish button without changing the character.

## Physical dice entry

Under **GM Controls**, enable **Allow physical dice score entry** (off by default). Rolled numbers and the existing layout stay visible until a score box is clicked. Click a starting score box to open its inline field; Enter, Tab or clicking outside saves a valid score, and Escape cancels. Enter the raw dice total, before species modifiers or Aezorgh halving. With boons, roll the displayed extra die and enter the sum of the retained dice. No individual dice are fabricated or verified. All six entries are required before keeping a manual set. Existing swaps and reroll limits apply. GM corrections remain independently controlled.

Each entry appears in Simple Log and Full Log with its previous and new values. A warning stays on the live, final and printed character sheets after any manual entry, including after disabling the option or rolling another set. Save/load retains the audit history.

## Requested options

0-6 boon rolls, score placement/swapping, optional minimum-total rerolls, and optional extra characteristics. These switches are explicitly identified as optional or house rules. Extra characteristics and species modifiers are excluded from the threshold. Boons apply to the first N rolls before allocation.

The single **Aezorgh: use 2D6 ÷ 2 for Stats** checkbox is under **GM Controls → House Rules**. Checked uses **House** (2D6 ÷ 2, round up); unchecked uses **RAW** (published mixed 1D / 2D). New Aezorgh setup defaults to checked. Switching species does not reset an explicit method selection, and a customized reroll threshold is retained. Existing saved configurations and historical rounding remain unchanged. The engine/API default is still RAW unless the explicit boolean option is enabled.

RAW Aezorgh use a raw-dice minimum of 30, with swaps within their one-die group and separately between DEX/INT; GM mode permits exceptions. Other species use 43 and can swap any of their six raw scores. The optional Aezorgh 2D6 method rolls all six characteristics with 2D6 and checks 43 against those raw totals before placement, halving or bonuses. Any raw totals may be swapped. After placement, STR/END/EDU/SOC are divided by two and rounded up, then species bonuses apply. A boon rolls 3D6 and retains the best two before division. This house option preserves the destination characteristic formula; it is not a published JTAS generation method. Rounding up here is the explicit campaign ruling for this house method, not a change to general division rules. Historical .16-.21 characters retain their original rounding down and recorded outcomes.

PSI is absent until tested or generated by a species rule. Players may select ordinary optional PSI at setup; it stays Untested until a valid event test or explicit GM score. The off-by-default GM house option permits testing without an event at a quiet pre-career or between-careers checkpoint, with referee-confirmed access and chronology. Testing takes two weeks and costs at least Cr5,000 unless explicitly source-provided; training is separate, four months and Cr100,000. The separate **PSI: enable GM activation** checkbox beside PSI at setup and in later GM controls enables only PSI score entry and management of the independent testing house option. Other result changes, roll replacement and restore remain locked. Enabling or disabling it never rolls PSI, grants talents or removes an existing score. GM result changes can remain off. This grants potential only, not trained talents. The preserved Zhodani Intendant/Noble option still requires GM mode and a Zhodani Traveller; it is deferred and is not selectable in this release. Native ordered training records every talent choice and check penalty; institute access, payment and timing require an explicit referee decision. Species-specific social and psionic rules are separate from optional human characteristics.

At the end of a Core career term, the eleven careers explicitly listed on Core p. 20 offer an assignment change. Retained-rank changes begin the next term after the check; restart paths collect benefits and then requalify at rank 0. Historical term assignments remain visible and printable. Alien and unclassified careers do not silently inherit these rules.

The action log is always recorded. Download the full technical history separately with **Download full log**; it is not repeated on the character screen or printout. The sheet shows only meaningful career events, decisions and consequences. GM controls retain a named restore-step selector. GM edits require a reason and keep the old result. Restoring or replacing an old result requires GM mode and appends an action; it does not erase history or rewind the random sequence. Save files include that history. This is a local audit trail, **not cryptographic proof, hidden randomness, or protection against a person rewriting their own file**.

## Career specialty information

Each career choice has a separate leading information button. It lists that career's specialties (assignments) from the existing career projection, including unavailable-assignment reasons and the source page. Close or Escape returns to the icon without selecting a career or changing the character.

## Data and saves

**Cancel**, beside the current step actions, opens a centered confirmation: "Are you sure? This will airlock your character." **Keep character** or Escape preserves all progress and unsaved fields. **Airlock character** replaces only the current draft with a fresh opening page. Exported files, other tools' records and protected unreadable drafts are not deleted.

The browser stores one draft locally. Unsaved biography text survives ordinary UI rerenders and is recorded before JSON export or the Print button. It is not saved merely by typing; the browser warns before unloading a dirty draft. Use **Save character & log** for backups before starting a new character. Import replays and validates the file before replacing the current draft. Unreadable stored drafts are preserved behind recovery controls, with raw backup download and explicit replacement confirmation. New characters use rules revision `character-preview-2026-11-09.27`. The verified compatible `.16` through `.25` revisions remain editable without changing its saved revision, events or historical escape outcomes; prior `.2`, `.3`, `.4`, `.5`, `.6`, `.7`, `.8`, `.9`, `.10`, `.11`, `.12`, `.13`, `.14` and `.15` saves are available only through read-only recovery. New saves record an explicit rules revision as well as save format 1. Only current or explicitly supported compatible revisions within the current release scope can be replayed. Zhodani saves still enter read-only recovery without rewriting their bytes, commands or audit history. Older development exports without a revision, and files from any unsupported rules revision, are rejected before character reconstruction. This prevents historical outcomes from silently changing when rules are corrected. The recovery panel can display their recorded actions as an unverified, read-only history and download the unchanged original file; it cannot reconstruct a validated character or continue that historical session. Invalid UTF-8 files are not imported, and their original File bytes remain downloadable. A malformed browser draft remains protected until explicit replacement. Keep exported backups when updating versions. No automatic migration or guessed historical rules are used.

No licensed books, scans, private document links, or borrowed Tremlas code are included. Own the relevant books to resolve source-assisted steps. Character names, notes, and campaign material stay in your browser or local API request and are not sent to the publisher, repository or visit counter.

## Verification

All existing engine tests and the full 45-career development smoke remain in CI. Release API tests separately verify 36 selectable careers and four species. Deferred browser scripts (games, reeducation, merchant-fine, zhodani-choice and cross-career) use `verification/development-server.mjs`; they are retained development coverage, not release acceptance. Mixed expansion/transfer scripts use that server only for Zhodani scenarios and the release server for Companion, Vargr and other supported cases. The release-scope browser suite checks both static and HTTP transports at desktop and 320px widths, including byte-identical rejected-save recovery. No original test is skipped or deleted.


```sh
node --test tools/character-generator/verification/*.test.mjs
node tools/character-generator/verification/cancel-character-browser.mjs /path/to/playwright
node tools/character-generator/verification/concise-result-browser.mjs /path/to/playwright
node tools/character-generator/verification/survival-result-browser.mjs /path/to/playwright
node tools/character-generator/verification/advancement-result-browser.mjs /path/to/playwright
node tools/character-generator/verification/life-event-presentation-browser.mjs /path/to/playwright
node tools/character-generator/verification/training-information-browser.mjs /path/to/playwright
node tools/character-generator/verification/full-log-browser.mjs /path/to/playwright
node tools/character-generator/verification/final-sheet-browser.mjs /path/to/playwright
node tools/character-generator/verification/release-presentation-browser.mjs /path/to/playwright
node tools/character-generator/verification/release-scope-browser.mjs /path/to/playwright
node tools/character-generator/verification/browser.mjs /path/to/playwright
node tools/character-generator/verification/review-browser.mjs /path/to/playwright
node tools/character-generator/verification/expansion-browser.mjs /path/to/playwright
node tools/character-generator/verification/benefit-browser.mjs /path/to/playwright
node tools/character-generator/verification/games-browser.mjs /path/to/playwright
node tools/character-generator/verification/aezorgh-skill-popup-browser.mjs /path/to/playwright
node tools/character-generator/verification/aezorgh-browser.mjs /path/to/playwright
node tools/character-generator/verification/aezorgh-selector-browser.mjs /path/to/playwright
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

Review [Mongoose's licensing page](https://www.mongoosepublishing.com/pages/traveller-licensing) and its linked fair-use policy. Speciality suggestions are restricted by the same pending-award eligibility checks as the engine. Open-ended subjects, languages and professions can still be entered within the awarded base skill. Training choices use small circled-i controls to open a popup. Popups show the implemented skill and characteristic outcomes in table order, including signed characteristic bumps and repeated entries, without die labels, weights or copied book explanations. Its original executable numeric mappings remain readable in source files. Neither a public repository nor static hosting provides source confidentiality; the localhost adapter also serves those files for static-mode compatibility. Avoid claiming that labels-only screens make the underlying rule data inaccessible.

## Source-assisted beta boundary

Normal automated paths and typed decisions retain their source, checks and mandatory action log. Generic book steps are manual: only supported effects entered there are applied. Future modifiers, permissions and other unsupported consequences must be tracked separately with the referee. Confirming a note does not implement those rules. Preserve exported files before updates; older rules revisions open only through unchanged-byte recovery.

## Result presentation

### Exceptional starting-total taglines

The existing statistics roll feedback adds one light-hearted line for a raw six-score total in either extreme tail (at most 5% per tail). Each outcome has six alternatives in the presentation-only `gui/outcome-taglines.mjs` catalogue. Ordinary totals retain factual feedback only. The classifier enumerates the actual recorded 1D/2D and boon dice, excluding species adjustments, optional characteristics, placement/halving and the configurable reroll threshold. Unmodified six-2D totals trigger at 31 or lower / 53 or higher; standard mixed-dice Aezorgh at 19 or lower / 37 or higher. Boons adjust those thresholds automatically.

The existing independently random action UUID selects the line without consuming rules RNG or adding saved data. The same action retains its line after rerender, reload or import. Only the latest original computer roll/reroll can show a tagline: swaps, physical entries, GM corrections, restored results and unsupported dice records remain factual-only. No popup, screen redesign, engine changes or audit-log changes are included. Run `node tools/character-generator/verification/outcome-taglines-browser.mjs /path/to/playwright` for static/HTTP desktop and narrow-screen checks and actual review screenshots.

A shared, read-only result panel names each roll and its recorded effects across supported career/species paths. Advancement and survival checks show verified success/failure, while secondary rolls retain their labels and totals. The character sheet keeps current rank, injuries, recorded medical notes, ongoing modifiers and entitlements visible. Proposed treatment and source-assisted consequences are marked pending, not applied. Core life-event titles and Vargr Good Fortune are named; other expansion results retain verified table and result identifiers where titles are not sourced. The existing detailed action log and text download are unchanged. These derived display fields do not change rolls, command summaries, saved rules revisions or save compatibility.

## Later-career basic training

### Separate term steps

The interactive builder now rolls survival on its own. A saved career-event or mishap checkpoint follows, with its own roll button, dice and short summary of the implemented table effects. Choices then resolve before advancement. Repeated table actions reject, and refreshing or reimporting the checkpoint cannot reroll automatically. Historical `survival` actions retain their original combined replay; new interaction uses `survival-check`, followed by `career-event` or `career-mishap`.

Regular training starts each later term. Event skill awards, rank bonuses and the additional successful-advancement training roll are independent awards (Core 2022 pp. 14, 18-19). The first career replaces its initial regular roll with basic training; a subsequent career receives its one basic-training choice and the normal roll. Table summaries describe implemented effects, not reproduced source narrative. Existing source-required outcomes remain explicit.

The basic-training choice and the regular term training roll are separate in a later career, including Prisoner. The first career alone replaces its initial regular training roll with basic training (Core Rulebook Update 2022, p. 18; Prisoner exceptions on p. 52). The screen names both steps and explains the transition without changing rules, saved events or existing save compatibility.

## Explicit Prisoner escape checks

Prisoner Event 3 names the escape opportunity, its risk, and separate Stealth and Deception 10+ buttons (Core 2022, p. 57). The new `prisoner-escape` command uses exactly the selected skill. The original `choose-effect` command and source table remain unchanged so recorded `.16` escapes replay identically. Compatible `.16` saves can continue interactively and retain their revision and original events. Saves containing the new command require this updated generator; backwards loading into an older app build is not supported. Older or malformed saves and deferred histories retain recovery-only handling.

## Contextual correction controls

Setup checkboxes choose extra characteristics to generate when the six core scores are accepted. The separate **Add another characteristic** control appears only afterwards, offering extras not already present. The GM panel is absent during setup; setup's existing GM option remains the single enable switch there.

After setup, GM tools show one task at a time. **Change a value** uses named fields, the actual current value and a required reason. **Replace a roll** lists recorded rolls by name and asks for each replacement die. A confirmation explains that later character progress is superseded; all original actions and their results remain in the detailed log. These presentation changes retain the existing correction and replay commands.

### Recorded pre-career interpretations (9 November 2026)

For new revised sessions, Merchant Academy graduates may enter any Citizen assignment as their first career. The curriculum-matching requirement applies only to Merchant Broker/Marine assignments (Companion 2024 p. 33). Failed military-academy automatic entry expires once another career is taken (Core 2022 p. 17). These are recorded user rulings resolving ambiguous wording, not newly quoted source rules. Compatible legacy sessions keep their previous adjudication path and recorded decisions.

Colonial Upbringing is unavailable at TL9 or higher, and School of Hard Knocks is unavailable at SOC7 or higher. These recorded eligibility rulings do not consume an education entry attempt when an ineligible selection is rejected.

School of Hard Knocks promotion/commission penalties persist through forced career exits and end after any subsequent voluntary career exit, under the recorded permanent-record ruling.

Colonial Upbringing is available only in the first generation term, before any career or other pre-career education. Nonstandard starting-age timing still requires an explicit source decision.

Academy commissions remain optional even with honours, allowing an enlisted career. University initial choices must be distinct skill bases, including when different specialisations are selected. These existing behaviors are now explicitly confirmed by the user.

## Historical .18 specialties and audit corrections

Existing .18 sessions defer ordinary unspecified positive specialist awards until allocation; new characters instead use immediate selection as described below. Players may allocate at a quiet checkpoint or during finalization; fixed named and source-constrained awards remain immediate. Checks that depend on unresolved skills settle the relevant awards first. This was the earlier presentation policy, not a claim that the books instruct all choices to wait until finalization. Separate awards retain their order, source and individual limits. Connections cannot bypass level three through aliases, and open Science, Language and Profession subjects share case-insensitive identities.

The same revision corrects forced Drifter draft continuation, earned-benefit forfeiture, Scout event departure timing and Believer immediate event promotion. Compatible .16/.17 sessions retain their original mechanics. The public four-species scope and deferred Zhodani recovery boundary are unchanged.

For new sessions, the conflicting Aslan Space Officer headings on Aliens 2026 pp. 38–39 use the explicit campaign interpretation: Shipmaster → Pilot/Gunner and Navigator → Engineer/Crew. Rank bonuses follow that mapping automatically for direct entry and officer opportunities. Historical .16/.17 saves retain their original source-resolution behavior.
The toolbar’s **View full log** information control opens the recorded action history without changing the character. Escape or Close log returns to the toolbar. The existing text download remains available both in the toolbar and the log viewer. Draft notes must be recorded before they appear in this history.

Believer event 9 now asks the player whether to accept payment or refuse during the event, without requiring GM mode. Before the choice, it shows the Benefit rolls forfeited, the Cr2D × 10,000-per-roll payment range, and that acceptance ends the career. The count includes accrued rolls, the survived current term and remaining rank entitlement, after any owed Benefit-roll loss. Acceptance records the payout and prevents forfeited term/rank rolls from reappearing. Refusal gains 1D Enemies and leaves ordinary advancement available. Historical .16/.17 saves retain the original source-resolution step.

Believer event 9: the player chooses either one 2D roll multiplied by Cr10,000 and the forfeited roll count, or separate 2D rolls per forfeited Benefit roll, summed and multiplied by Cr10,000. Both acceptance options leave the career; refusal gains 1D Enemies. The recorded calculation shows every result, formula and total. This calculation choice is an explicit player ruling; legacy .16/.17 source-resolution is unchanged.

## Immediate specialty selection

New characters choose a specialty when an award requires one, as the skill is received, rather than waiting for finalization. This follows the player's latest timing decision. Earlier .18 saves retain their recorded deferred-award workflow and can still allocate pending awards without losing them; importing a save does not silently change its rules revision. Legacy .16/.17 compatibility and the other .18 rule corrections remain intact.

## Event descriptions and results

Event result panels and the full action log now include concise, original source-backed event context, the actual table dice, the table’s possible mechanical outcomes, and separately recorded character changes. Pre-career, career, mishap and nested life/unusual event results use the same read-only projection. Typed event decisions retain their parent context; choices and checks remain explicit rather than being presented as already-awarded effects. Known nested disaster mishaps retain their table provenance and protection against automatic career ejection. Source-assisted outcomes remain pending and unknown narrative rows are not invented.

These display fields are derived after replay validation and never change saved commands, summaries, rules revisions, dice or character state. Historical save bytes and original log fields remain unchanged.

## Separate borrowed-career rolls

New `.20` characters pause between undercover checks, borrowed career tables, subsequent checks and random consequences, Life/Unusual tables, and injury table/severity dice. Each pending step is saved before its next roll. Relationship choices do not roll the later consequence. Published dice, modifiers, outcomes and career accounting are unchanged. Other generation procedures outside these borrowed-career routes are not claimed to be fully separated.

Existing `.16`–`.19` recorded commands retain their original combined outcomes. The UI uses explicit new cover and relationship commands for future separated steps without rewriting those saved histories or revisions.

## Assets and benefits at finalization

New .21 characters retain ordinary Core Armour, Blade, Gun, Weapon, Scientific Equipment and Personal Vehicle awards automatically as generic entitlements. Item details wait until finalization; each award has its own button and source-limited popup. Review assets & benefits also opens the checklist between benefit rolls or careers. Cancel keeps the award pending. Separate repeated awards are never collapsed into one item.

Repeated received-weapon skill improvements and armour trade-ins stay linked to eligible earlier awards. A skill improvement remains unapplied until resolved, and interrupts only when a later skill change, relevant characteristic change or next career needs it. Unrelated pending equipment does not cause that interruption. Choose a listed Core item or enter a source/referee-checked custom item. The bounded catalogue contains two Cloth variants, Blade, Cutlass, Dagger, Autopistol and Rifle; it is not a complete equipment or combat engine. Augmentations, small craft, ship-history rulings and unsupported benefits retain their existing handling. Earlier .16–.20 saves retain their original immediate equipment workflow.

Core unusual-event Alien Artefact and Ancient Technology awards are retained as generic owned objects. Their finalization popup accepts an optional name/placeholder and description, including blank/unknown, without assigning powers or value. This timing and permissive description handling follows the user ruling; source ownership and event chronology are preserved.

## Clickable Aslan event outcomes

Existing source checkpoints now offer typed controls for Dishonoured defence (Advocate 8+, confirmed clan Contact/Ally +2, or Melee (natural) 10+), Outcast Event 10 optional automatic qualification next term, Wanderer Event 12 SOC and parcel entitlement, Guardian retained-secret shares, male Rite equipment credit, and Territory Challenge. These are additive commands: historical source resolutions and saved revisions replay unchanged.

Outcast qualification permission expires after the next term and does not force a career change or remove unrelated prerequisites. A retained Guardian secret rolls 1D immediately under the recorded player timing ruling, storing conditional shares separately from spendable Clan Shares. Rite credit is restricted to art, armour or weapons, not cash. Landhold name/location remain pending for finalization or a GM placeholder. Territory Challenge uses the recorded 8+ player ruling and signed Effect; only identified personal holdings change parcels, while an explicitly landless character changes SOC. Unprinted parcel sizes and unrecorded property remain source-assisted rather than guessed.
### Restricted credit and landhold details
New-rule Aslan rite equipment credit and Wanderer landholds join the finalization checklist. Landhold name and location are optional GM placeholders; entering them never changes awarded parcels. Credit purchases are limited to the retained Art/Armour/Weapon budget, use verified catalogue rows or source-confirmed custom entries, and never become cash. Purchases save immediately; closing or cancelling preserves purchases and the remaining balance. Unspent credit may be retained. Historical characters are not retroactively blocked by these detail controls.

The minimum raw total is adjustable in setup (whole numbers from 6 to 72). It defaults to 43, or 30 for standard Aezorgh; the optional all-six-2D6 Aezorgh method defaults to 43 before placement and halving. Custom totals remain selected when changing species or dice method. Rerolls remain enabled by default and are available only below the selected total. Saved characters without this option keep their original defaults and recorded history.

## Connections entry timing

The live record keeps Background notes available during creation. Add a connection appears only after Finish character reaches the final review, not at setup, between terms, retirement or the equipment checklist. Existing recorded connections, skill awards, saves and audit history remain unchanged. Historical pre-finalization connection commands still replay under their original rules.

## Characteristics-page presentation

The opening navy/gold theme continues through rolling and placing the six characteristics. The live record keeps the selected illustrative species portrait. Before rolling, six species-appropriate placeholders are shown; rolled scores retain their raw values, species modifiers and dice method. Existing swapping, reroll thresholds, acceptance, save/replay and audit commands are unchanged.

The opening **Boon rolls** house-option selector now lives inside **GM Controls → GM Settings**. The statistics page shows that setup choice read-only alongside the existing GM correction tools, closed by default. Help and logs are read-only. Later character-generation screens retain their existing presentation.

Selected optional characteristics appear before acceptance without invented values: PSI is shown as Untested and other selected extras as Pending. PSI alone shares the six-score row when space permits. Selecting any other extra starts a separate row of additional cards, matching the width and height of the six primary cards and wrapping on narrow screens. Keep generates selected extras other than PSI separately; they do not join the swap pool or reroll total. Required species characteristics are not duplicated as optional cards. The raw total is prominent in a summary strip after the swap controls and immediately before Keep/Reroll, with GM Controls at the bottom. Before rolling, the empty summary sits above the Roll action. Roll/reroll feedback stays concise, with Roll details opening the existing read-only Simple Log for recorded dice and earlier results; the Full Log remains unchanged.

`verification/characteristics-facelift-browser.mjs` covers static/HTTP transport, 1440px/390px/320px layouts, help and disclosure keyboard behavior, repeat actions, projected reroll/placement eligibility, species formulas, enabled-extra grouping and save/export/import/reload continuity. The focused presentation tests verify that rendering does not mutate projected state or history.

## Flat starting Luck house rule

**GM Controls → House Rules → Start Luck at 6** is off by default. It replaces only the initial Luck roll with 6, without rolling or consuming dice. Checking the house rule also checks Luck under Characteristic options, so it is included at Keep. Turning the house rule off leaves Luck selected, using normal 2D; uncheck Luck separately to remove it. If Luck is explicitly deselected or absent in a saved configuration, it can still be added later using Add another characteristic. Set it before rolling the six base characteristics; GM result changes do not need to be enabled.

Luck remains outside placement and the six-score reroll total. Other extras retain their normal formulas. Existing Luck values are not reset, including GM edits or spent Luck. The action log records the house rule separately from the published 2D method. This additive option leaves the rules revision unchanged: saves without it retain their exact historical commands, summaries and random sequence. Saves explicitly using the new option require this updated app.

## Header beta notice

The **Beta 0.1** informational in the header opens the complete existing beta limits in a centered, scrollable window. Close or Escape dismisses it and returns focus to the header control. The notice stays available throughout generation and does not alter character choices, saves or the action log. `verification/beta-notice-browser.mjs` covers static/HTTP, desktop/mobile, keyboard, repeated dismissal, intact content and unchanged state.

### Imperial Vargr Charisma

New Imperial Vargr retain SOC in the six base characteristics. CHA is absent unless selected in GM Controls > Characteristic options, then generated once as 1D6 + 2 when the base scores are kept. Adding CHA later uses the same formula. This campaign ruling does not require GM result changes to be enabled. Native Vargr keep their automatic base CHA and strain rules. Revisions .16-.22 preserve their original automatic Imperial CHA and RNG sequence, including historical selected-extra rolls; they are not migrated or rerolled.

### GM stat cards and separate PSI testing (.24)

With GM result changes enabled, numeric stat squares open an audited final-score editor. Before Keep, the entered value is the final score: species bonuses and Aezorgh halving are not reapplied. Original dice and raw totals remain unchanged. Raw swaps retain final overrides on their destination characteristic; rerolling starts a new set. Pending optional cards in older saves remain informational until Keep applies their recorded rules; their accepted scores can then be edited. The legacy raw-score correction controls remain available and explicitly replace a final override when used. Aezorgh CHA remains derived from SOC and its editor identifies the controlling score.

The PSI information button sits beside the heading; the card body opens testing or GM-entry choices. Selected PSI stays Untested in new .24 characters until tested or assigned, including through Keep. Existing event testing and Psion permissions are preserved. The explicit testing-without-event house option grants testing access only, not automatic career entry, talents, debt or training. Tested potential is retained when choosing training later; any special delayed-training decline needs referee adjudication rather than an invented decay formula. Compatible .16-.23 saves retain exact recorded rules and random sequences.

### GM stat cards and separate PSI testing (.24)

With GM result changes enabled, numeric stat squares open an audited final-score editor. Before Keep, the entered value is the final score: species bonuses and Aezorgh halving are not reapplied. Original dice and raw totals remain unchanged. Raw swaps retain final overrides on their destination characteristic; rerolling starts a new set. Pending optional cards in older saves remain informational until Keep applies their recorded rules; their accepted scores can then be edited. The legacy raw-score correction controls remain available and explicitly replace a final override when used. Aezorgh CHA remains derived from SOC and its editor identifies the controlling score.

The PSI information button sits beside the heading; the card body opens testing or GM-entry choices. Selected PSI stays Untested in new .24 characters until tested or assigned, including through Keep. Existing event testing and Psion permissions are preserved. The explicit testing-without-event house option grants testing access only, not automatic career entry, talents, debt or training. Like other setup house choices, the option can be selected under GM Controls while GM result changes stay off; subsequent changes require GM mode. Tested potential is retained when choosing training later; special delayed-training decline needs referee adjudication rather than an invented decay formula. Compatible .16-.23 saves retain exact recorded rules and random sequences.

## Background skill selection interface

The background screen uses a compact selection grid and a separate pending preview. The selection count and available skills come from the existing rules projection. Accept is enabled only at the exact allowance. Character actions, Full Log, and the complete character record with Notes and GM controls remain accessible. Detailed action results stay in the logs rather than on this selection screen. Pending checkbox choices survive ordinary rerenders and Cancel/Keep, but are not saved until accepted; loading a character, restoring a checkpoint, or reloading clears them. No rules or save revision changes accompany this interface.

Focused checks: `node --test tools/character-generator/verification/background-skills.test.mjs` and `node tools/character-generator/verification/background-skills-browser.mjs /path/to/playwright`. The browser suite covers static/HTTP mode at 1440, 390 and 320 pixels, interruptions, import/restore, retry, logs and printing.

The right-hand Character sheet and Selection preview bars form an accordion: opening either closes the other, and either can be collapsed. Switching panels does not accept skills or change the character, pending choices, notes or log. The sheet remains first in the rail, including on mobile, and printing includes the live record even when its bar is closed. The outer content width is consistently capped at 1440px throughout the tool and reflows on narrow screens.

## Aezorgh skill choice

At background selection, only Aezorgh open a centered modal over the dimmed, inactive base screen. The four granted skills appear in one line. Search the alphabetical list, select one skill, then Confirm to record it at level 0. New `.25` sessions offer all base skills except Jack-of-all-Trades (no benefit at level 0), psionic talents, Aslan cultural skills (Independence, Tolerance, Rites), and any already owned base or specialty. Engine validation uses the same eligibility and rejects duplicate, missing, multiple or specialized choices. Historical `.16`–`.24` saves keep their original ordinary background list, revision and replay outcomes. Other species retain their existing background interface and rules. Escape leaves this required choice open without recording anything.

The shared character toolbar stays across the top on every generation screen, including background selection. Save, load, print, both logs, log download and New character remain visible without expanding a Character actions menu.

## Optional Aezorgh Charisma (.27)

New Aezorgh leave CHA off by default. For a Vargr campaign, explicitly select Charisma in optional characteristics or use Add another characteristic after accepting scores. CHA is half SOC, rounded down (JTAS Vol. 11 p. 67), with no dice roll, and follows subsequent SOC changes. There is no automatic campaign detection. Existing compatible `.16`–`.25` characters keep their recorded CHA and replay unchanged. Revision `.26` is reserved for a separate unpublished candidate.
