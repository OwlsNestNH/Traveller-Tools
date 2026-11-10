# Coverage and release gates

Status: source-assisted Beta 0.1 candidate; merge/deployment require the release gates below. A data table being present does not mean every resulting rule is automated. The UI must preserve this distinction.

## Source scope

- Core Rulebook Update 2022: 12 principal careers, Prisoner and Psion; University and three military academies.
- Traveller Companion Update 2024: two careers and five pre-career pathways; selected optional characteristics.
- Aliens of Charted Space Volume 1 Update 2026: Aslan and Vargr species/careers in release; Zhodani species/careers deferred. K'kree deliberately excluded.
- Journal of the Travellers' Aid Society Volume 11: Aezorgh species rules, using applicable Core/Vargr career paths.

These edition choices matter. In particular the 2026 Aslan characteristic modifiers differ from earlier sources. Short numeric representations carry page references. `SOURCE_DISCREPANCIES` records conflicting summary/detail entries rather than pretending the books are perfectly consistent.

## Release versus preserved development coverage

The supported public API and GUI expose four species and 36 careers; nine Zhodani careers, Zhodani generation and its Intendant/Noble PSI option are excluded. Human optional PSI and Core/Vargr Psion are not excluded. Both transports reject deferred commands and histories, including imported matching-revision files and superseded actions before restore; recovery preserves their original bytes and unverified history.

The current rules revision is exported as `RULES_REVISION` by `engine/session.mjs`. Existing `.16` through `.22` histories retain their recorded rules, commands, revision and event bytes on import. New characters choose required specialties when skills are received; `.18` saves retain their deferred-award workflow. New explicit escape commands require this updated build. Revision `.15` and earlier remain read-only because earlier source-native procedures changed mechanical outcomes and audit history. Existing full-engine tables, procedures, fixtures, unit tests and 45-career smoke are preserved. The implementation inventory below includes deferred development coverage and must not be read as a list of released features. All Zhodani-only procedures and Games tests described below are preserved development coverage.

CI retains all browser scripts. Five deferred suites use an explicit verification-only development server. Expansion and transfer suites keep non-Zhodani cases on the release server and use the development server only for deferred scenarios. A separate release-scope browser suite checks desktop/320px, static/HTTP, absence of Zhodani choices and exact-byte recovery. There is no request-controlled unlock. Release tests and deferred tests must both pass, but passing deferred tests does not expand release scope.

Limited Aslan outward rights allow only their stated elective destinations. Failed scoped Scholar qualification permits ordinary Drifter fallback, not elective wider careers or the Core draft.

## Believer false-teachings ruling

New revision histories apply the user ruling for Companion 2024 p. 39, mishap 4: if neither Profession (religion) nor Science (belief) is above zero, the Traveller cannot pay the skill-reduction cost of staying and is ejected. This also overrides event 2's normal protection against ejection. With an eligible skill, the Traveller chooses it, reduces it once and stays. Existing .20 and earlier histories preserve the source-assisted fallback and original replay behavior.

## Implemented infrastructure (including preserved development)

- Independent versioned JSON rules API and optional localhost HTTP adapter.
- Original, readable responsive interface with large controls.
- Always-on deterministic event log; rules-revision-pinned save/import, print and GM-gated audit-preserving restore. Unversioned or different-revision files are preserved for unverified read-only history recovery; historical mechanics are never silently reinterpreted.
- Logged GM changes and replacement dice, with reason and retained original record.
- Requested first-roll boons, placement, minimum-total rerolls and extra-characteristic controls. Standard Aezorgh use30; their optional six-2D6 method uses43 before placement/halving, free swaps and destination-specific rounding up in new .22 sessions (historical .16-.21 sessions retain rounding down). Both are explicitly labelled house options.
- Species-specific stat formulas, basic backgrounds and career filtering.
- Numeric training, rank, material/cash benefit, event and mishap tables for all 45 development careers (36 in release scope).
- Native Core University/academy entry, initial awards, events, graduation/honours, deferred service awards, future entry/qualification rights and pre-term commissions, with explicit source-assisted exceptions.
- Native five Companion education paths, constrained awards, graduation and persisted career rights, with explicit cross-book and psionic exceptions.
- Native Core Citizen Event 3 (p. 27), Navy Mishap 3 (p. 37) and Vargr Intermediary Mishap 5 (Aliens 2026 p. 193): explicit skill/check choices, current-assignment restrictions, next-check modifiers, retained term benefit and stay/injury consequences through the audited effect queue.
- Native ordinary injuries, partial restoration, listed employer contributions, source adjudication for unlisted employers/zero scores, and end-of-creation medical bill settlement. Ageing crisis funding remains a separate explicit decision.
- Vargr strain overlays, native/Imperial social statistics, Aezorgh derived Charisma, and the published Aslan rite-of-passage double results.
- Native ordered Core/Zhodani talent acquisition, persistent check penalties, source-based career retry opportunities, initial Zhodani training and career elevation. Companion childhood training reuses the same workflow. Institute access, costs and chronology are explicitly approved rather than assumed.
- Source-keyed named benefits, stable equipment/ship assets, same-table duplicate Scout rerolls, same-ship mortgage progress, bounded equipment selections, recurring Patronage and culture-specific pensions. Book decisions remain explicit for ambiguous definitions and ship history.
- Persisted, next-term alien transfer rights for Zhodani Army to Guard, Guard to Agent, Merchant to Navy and Vargr Loner to Spacer/Corsair. Source rank/assignment and expiry conditions are retained. Merchant-to-Navy rank track remains an explicit referee decision, rather than an assumed officer commission.
- Bounded native Psionic Games at an existing-career term boundary: lifetime application, ordered talent checks, final, explicit event/award rulings, one replacement term, inherited benefits and due ageing. Initial-career entry timing and complex ordinary event consequences remain outside this route.
- Native Zhodani career PSI elevation and re-education outcomes, with explicit referee decisions for unprinted modified results, sub-year durations, treatment chronology, contradictory discharge, insufficient fine funding and END zero. Separate non-career time and ageing credit preserve career training, advancement, benefits and pension accounting. Ordered treatment/term ageing resumes the saved context; age-caused permanent PSI loss retains historical talent records.
- Native Zhodani Merchant mishap fine: one logged die, immediate affordable cash payment or explicit decline, retained source/protected-event context, and linked Prole re-education. The original and any later treatment fine are distinct records. Nonpayment versus row2 continuation requires a typed precedence ruling unless protected by the source event. No automatic financing or duplicate charge.
- Native Prole Ally/Contact removal before re-education, including exact removed-entry history and an explicit empty-roster ruling. Scholar secret research enforces two distinct Science specialities across save/replay and interrupted choices. Government mishap checks let the player choose PSI, Melee or Recon and preserve injury/stay consequences without an extra Event after failed survival.
- Native Aslan origin setup after accepted final statistics: immutable family SOC/provenance, supplemental family awards, source birth-order dice, separate family-estate minimum, clan/scope and pride rolls, ordinary background skills then rite. Explicit GM decisions cover unprinted family/estate values, female Independence and unsupported mechanical gender branches while preserving the chosen identity. Estate and inheritance records never grant personal ownership by inference. Family Outcast classification is not past career history.
- Native Aslan event-earned officer-entry offers from Military Event 10 and Spacer Events 5/10: following-term timing, originating-career term DM, targeted minimum-service waiver, one set of exit benefits and a fresh rank-zero officer career. Forced stay remains binding. Early cancellation can retire, while independently legal exits may return to career selection. Female Space Officer rank headings and historical status exceptions remain explicit, GM-enabled source decisions; neither is guessed.
- Audited native Aslan Outcast status and held Clan Share forfeiture on voluntary entry, qualification failure and explicit status effects, including shares just received during mustering out. Original award records remain annotated; unrelated benefits and cash are retained. Already-redeemed assets are not repossessed by inference.
- Native Clan Share lots track original awards, spending and exact partial forfeiture. At safe generation checkpoints, verified holdings can become female cash, non-cash-redeemable Ship Shares, a named-clan upper-echelon Contact, or an Ally upgrade of a matching existing Contact. Stable relationship IDs distinguish same-name people. Source-only and clan-affiliation verification require typed GM decisions; unknown quantities are never invented. Exchanges neither roll dice nor consume cash-benefit rolls, change WLT, advance time or interrupt mandatory procedures. Cash received before finishing can fund normal medical settlement; later exchanges do not repeat settlement or repay debt automatically. Corporate holdings and cross-character pooling remain separate unfinished paths. Land has the distinct delayed workflow below.
- Native Aslan career access uses actual Outcast/Outlaw history, with existing narrowly scoped restoration/officer exceptions preserved. Source-earned Scientist→Scholar and Outcast expedition rights have explicit destination, next-term timing, one actual attempt, mandatory continuation gates and auditable expiry. Upbringing remains native. Failed outward Core qualification does not add native SOC loss or Clan Share forfeiture; its Drifter/draft context is projected separately. Manager’s specific next-Outcast mandate remains enforced. A natural-12/expedition conflict requires an explicit GM precedence choice with original dice retained.
- Native careers muster out under Aslan rules before outward Core entry. Outward Core records then use full Core cash, a separately tracked Core lifetime three-roll limit and Core pensions, preserving earlier benefits and native ageing. The GUI uses the selected cash account instead of comparing aggregate native-plus-Core rolls to the Core cap. Corporate-employment routes and general native assignment rank mappings are still unimplemented.
- Native male Clan Share land redemption combines at least three genuine shares at current SOC 9+, freezes the current printed parcel calculation or an explicit unprinted-SOC GM baseline, and records a selected world and normal 1D + 3 year delay. It creates only a pending claim and does not advance time. Later maturity and an explicit actual-claim GM confirmation create a separate personal land asset; relative administration needs Independence 3+. Claims remain visible with no unspent shares and are not resized or repossessed by inferred later status effects. Original lots, delay dice and all decisions remain audited. No world catalog, parcel dimensions, travel, inheritance, income or cash valuation is invented.
- Male Clan Share art is recorded as a described, personally owned holding with its share-derived assessed value, never cash or an assured resale price. Weapon bundles use exact item quantities, prices, TLs and references verified by an explicit GM source decision, not an automatically checked equipment catalog. An under-budget bundle needs a separate typed acceptance of lower value; its unused value is surrendered without change or credit. Over-budget bundles and cash supplementation reject. These assets preserve original lots/award IDs and survive later forfeiture of unspent shares. Ordinary Weapon-benefit price/TL limits and repeat skill awards are not borrowed. Unpriced or unrated weapons still need further source handling.
- Outcast Event 11 restoration with GM-verified original SOC, an explicit status-timing ruling, a single next-term qualification right and preserved forfeiture history.
- Outlaw Event 11 has separate male restoration/three-Share and female marriage/normal-2D-SOC procedures, with verified original SOC or marriage eligibility, mandatory departure, normal ageing and exactly one benefit settlement. Any restored historical career access remains a separate typed GM ruling for one requested normal qualification attempt; it is not an inferred permanent unlock.
- Core p. 20 assignment changes for the eleven explicitly named careers: retained-rank checks start the next term, while restart paths finish benefits before fresh qualification. Historical assignments, officer/highest-rank state and the lifetime cash count are preserved. Core Noble SOC 10+ qualification is automatic. Unsupported career categories are not guessed.
- Native Agent undercover routing preserves nested Prole Event/Mishap source identity while retaining Agent career accounting, with one chosen Prole assignment roll only after success. Re-education, skill interruptions and terminal outcomes preserve the original continuation.
- Native Government advisory service uses a dropdown for another Zhodani career, its Service Skills roll and an immediate same-career cash benefit. This is the selected interpretation of the source wording. Cash counts toward the normal lifetime limit; a full cap preserves the award pending an explicit logged GM waiver or override. Government rank/scoped modifiers and ordinary benefits are not consumed. Gambler, selected global credits and optional WLT are accounted for separately.
- Prole Event 3 global and Event 4 career-restricted one-roll benefit credits have stable identities and explicit selection; unselected credits remain available. Unprinted advisory cash results retain the die, modifier, credit use and cash-roll count until a typed GM amount ruling.
- Derived before/after action details include treatment time, source decisions, fine/payment ledgers, status reviews, permanent PSI loss and transfer rights without dumping internal rule queues. Printable notes/connections and medical ledger.
- Ten additional shared alien event tables and explicit constrained-effect metadata.
- Pure Core medical, injury, ageing, pension and benefit procedures with source-grounded tests.

## Automation boundaries

Ordinary failed-survival mishaps that permit staying close the term under the specific Core2022 p14 flowchart. The general p18 Events paragraph is not treated as permission for an extra Event in that branch. Protected Event2 mishaps resume their existing after-event queue; Prisoner retains its explicit p52 advancement exception.

Routine training, checks, table rolls, many choices, rank awards and benefits are automated. Unsupported effect kinds and special source routes must stop at a source-assisted step with a reference. They must never be treated as successful no-ops.

Important areas still needing integration, deeper testing or source adjudication include:

- Companion cross-book exceptions, career transfers outside the four explicitly implemented routes, and assignment changes outside the eleven explicitly classified Core careers.
- Psionic acquisition histories from older/manual records, repeat-course chronology and untraceable retry awards require source decisions. Zhodani re-education covers supported source-earned triggers and all six outcomes, but unresolved source timing and consequence ambiguities remain typed referee decisions. The implemented Agent and Government wrappers retain explicit decisions only for source interruptions or unprinted outcomes. Wider setting-level status, suppression and anagathic history are not universal automatic rules. Games source ambiguities are explicit rulings, not silently selected defaults.
- Aslan inheritance timing, nonstandard land-delay exceptions, land income/valuation, unpriced or unrated Clan Share weapons, corporate redemption and wider gender/culture career restrictions. Native family/clan/pride setup and ordered rite handling are implemented, but do not establish complete Aslan generation.
- Non-standard Vargr and Aezorgh cross-book choices, derived social characteristics and career restrictions.
- Nonstandard injury/medical rules, detailed equipment verification, ambiguous ship-history procedures and unimplemented bespoke benefits. Unpriced/unrated Clan Share weapons and corporation choices need further handling; unspent shares remain recorded entitlements.
- Automatic event commissions at SOC below 9 after the first term retain ordinary eligibility pending a source ruling. Zhodani pension amounts record their exit-class basis; later class changes flag a source review rather than silently changing entitlement.
- Other event branches requiring wagers, custom checks, referee choices, prior-history changes or future conditional obligations. The 26 optional Core/Vargr one-roll modifiers now use selected source-scoped credits; the coupled extra-roll Merchant result and other cultures retain their separate rules.
- Optional characteristic consequences throughout careers. Displaying Luck/Morale/Wealth is not a claim that every optional rule using it is automated.
- Deeper full-character and multi-career coverage beyond the bounded public-API golden scenarios. White-box continuation stress covers all career assignments but bypasses qualification/species setup and stops at source-assisted decisions.
- Optional anagathics, post-career purchases and campaign group-skill packages are not fully automated.

Some of these have data/helper implementations but are not yet wired into all engine/UI paths. Inspect the current integration tests and actual stop points before relying on an area above.

Manual resolution is an acknowledged development fallback, not equivalent to fully implemented rules. A note alone cannot reliably encode every deferred permission, prohibition, transfer or talent condition. Such cases require continued engineering rather than advertising a fully automated result.

## Release gates

1. Close or explicitly scope each remaining mechanical gap. Do not silently claim full Core/Companion/alien support.
2. Run all engine, integration, API and browser tests against the exact candidate revision. Add multi-term golden scenarios and malformed-save regressions.
3. Complete independent rules/code review and fix material findings. Re-run review after consequential changes.
4. Test desktop and narrow/mobile layouts, keyboard focus, screen-reader announcements, save/load, printing and meaningful failure recovery.
5. Retain the prescribed publisher notice and review actual distributed content against the current policy. The site operator reports that Mongoose is aware of the site and handles publisher correspondence. Do not display full table pages or copied explanations. Document that public source files and static deployments expose the executable mappings; a labels-only interface is not source confidentiality. Do not represent publisher endorsement.
6. Candidate branches and draft PRs may be used for CI under the user's authorization. Merge/deployment must wait for required tests and review, with any remaining source-assisted scope explicitly stated. Keep robot/trade work isolated and verify the current main branch before integration.

## Test evidence

Run `node --test tools/character-generator/verification/*.test.mjs` for the current unit/integration/API result. Run `verification/browser.mjs` with Playwright for desktop/mobile evidence. Generated results and screenshots are local artifacts, not a substitute for a source-rule review. Do not infer full correctness merely from all existing tests passing.

Bounded Vargr event training is automated for Loner's assignment-only award (p. 195) and eligible-career awards for Agent, Intermediary, Merchant, Scientist and Spacer. Candidates come from actual eligible tables, including nested skill alternatives and exact printed specialities. The UI lists only these candidates and the engine rejects out-of-table awards atomically. Citizen Event 4 (p. 191) now grants exactly one Advanced Education roll even below EDU 8, with ordinary eligibility unchanged for subsequent training. The Truther-specific scopes described below are native; other unverified cross-book scopes remain source-assisted. Regression coverage includes the public `audit-0` Loner seed, low/high-EDU Merchant events, HTTP validation, replay, source retry, and static/HTTP narrow/desktop browser checks.

Navy Mishap 4 (Core 2022 p. 37) responsible branch offers one roll on a currently qualifying Navy training table, including only the active assignment and eligible advanced/officer tables. The not-responsible branch remains Enemy plus retained term benefit. Both source training routes retain their event/mishap continuation, store source/table/die/context history, and resume after nested skill choices. Public command, atomic rejection, pending/completed replay, HTTP and CI browser fixtures cover these routes. No generic table-prerequisite bypass is provided.

### Bounded benefit wagers

Core Merchant event 5 (p. 35), Rogue event 10 (p. 41) and Aslan Manager event 5 (Aliens 2026 p. 29) now offer typed optional stakes against already accrued, unspent rolls in the active career only. No unfinished-term, future-rank, other-career or loan entitlement is assumed. Manager is capped at three. Merchant explicitly selects Gambler or Broker and increases that skill after either rolled outcome; refusal does not train. Rogue receives its unconditional Gambler 1 before the offer. Failure cannot make benefits negative. Pending state preserves the exact effects continuation; source/career/assignment, decision, check and balance changes are audited and replayed. Browser CI covers static/HTTP at 320px and desktop widths.

### Core/Vargr undercover coverage

- Core Agent Event 8, Core 2022 p. 23: explicit Rogue/Citizen cover, Deception check, borrowed Event or Mishap and successful one-roll specialist training.
- Vargr Agent Event 9, Aliens 2026 p. 189: explicit bounded cover, Deception check, failure Mishap or successful specialist roll plus originating Agent next-advancement DM+2. Success does not roll a cover Event.
- Bounded Vargr scope: the eight other native Vargr careers and Core Drifter, grounded in Aliens p. 186. Cross-cultural/Companion covers are not classified by the event and remain outside automation pending a referee/source ruling. No entry qualification or new career credit is implied by a cover.
- Route provenance, nested protected Mishaps, source interruption, fatal injury cancellation, atomic invalid input, idempotent retries, replay/import, audit, HTTP and existing deferred Zhodani behavior have dedicated regression coverage. The additional browser CI suite exercises static and HTTP transports at 320px and desktop widths. Local browser execution was not attempted in the restricted cloud executor.
Prisoner Event 9 (Core Update 2022 p. 57) has a typed cash-funded lawyer procedure with explicit refusal, square-cost pricing, inclusive 8+ Advocate check, success-only reduction die, audit/print history and normal parole advancement continuation. No player creation skill cap is applied to the hired NPC. Level-0 eligibility remains an explicit referee ruling; no debt or outside funding is invented. Public-path Node/HTTP tests cover rejected and duplicate decisions, restore/replay, import, exact threshold checks, insufficient funds and higher-level lawyers. Desktop/320px browser coverage exercises static and HTTP transports, interrupted pending saves, rejection, double activation, reload and print in CI.

### Follow-up review checkpoint

Core life/unusual events, common source checks, one-off Navy/Vargr training exceptions, optional Core/Vargr benefit credits, three accrued-roll wagers, bounded Core/Vargr undercover routes, Prisoner lawyer appeals and the Aslan skirmish/Vargr leadership choices have source-backed regressions. Borrowed Rogue wagers use the actual Agent's accrued balance while retaining separate source identity. Aslan checks use the exact awarded specialty. Explicit manual/over-cap award disposal preserves a required source-check stop; generic effects cannot install its future advancement modifier, so that branch remains manual bookkeeping rather than automated success resolution.
#### Relationship changes and removal

Core pp29, 31, 41 and 237 and Aliens pp41 and 43 now have typed relationship consequence choices for Drifter, Entertainer, Rogue, Psion, Aslan Outcast and Outlaw. Choices preserve exact person identity, existing names, source and career provenance. Printed empty-roster replacement and term-Benefit-loss branches are implemented; Psion's unprinted absence outcome remains explicit source adjudication. Existing deferred Zhodani behavior is unchanged. Public command histories, replay/import/restore, atomic rejection and HTTP checks are in `relationship-events.test.mjs`; CI browser coverage runs at 1440px and 320px over static and HTTP transports.


### Constrained talent and skill awards

Core Psion service result 6 (Core pp. 229, 236) now uses the normal ordered acquisition/retry procedure for a new common talent and improves an acquired talent normally. Truther Event 5 permits a new Electronics/Science speciality, and Event 9 grants two levels in one permitted skill (Companion p. 37). Vargr Psion Event 6 excludes talents and psionicology; Event 8 success grants one new common talent at level 0 without another acquisition check, retaining earlier check penalties and history boundaries (Aliens p. 201; Core p. 228). Caps, permanent loss, absent potential and unknown-history decisions are not bypassed. Public command/HTTP, forged-save, replay, atomic rejection and static/HTTP mobile/desktop tests cover the bounded routes.

### Explicit remaining release boundaries

These paths are not advertised as automated by this candidate. They stop with source context and preserve the pending character and action log. The generic source form can record supported immediate effects and notes, but cannot install arbitrary permissions, transfers, deferred awards or future modifiers. Save/export remains available; referee bookkeeping or further implementation is needed for unsupported consequences.

- Vargr unusual-event psionic-testing opportunity (Aliens p. 206), beyond the separately implemented Core testing route.
- Exceptional Aslan land outcomes with unprinted parcel sizes or unrecorded property still require explicit source review. Bounded Outcast Event 10 optional next-term permission, Guardian Event 3 retained secret entitlement, life Event 11 defence and Wanderer Event 12 land awards are implemented in the current candidate.
- Specialized Aslan kinship, Brotherhood, Secret School and standalone Land Parcel benefits (p. 47); Companion Sainthood and repeated Patronage stacking; the first Core Ship's Boat award/alternative interpretation, repeated Cybernetic Implant upgrades, and unverified Combat Implant definitions. Existing ordinary material benefits do not establish these bespoke procedures.
- Remaining unimplemented Aslan gender/culture branches; Aezorgh derived Charisma versus independent social-statistic changes; wider cross-book education and career access; and unprinted cap, third-party injury, medical-funding, below-first-row benefit results and history cases. Generic fallback citations may identify a career's opening page rather than its exact event page; this beta does not claim precise-page certification.

Common Core relationship paths, the specified constrained talent/Truther awards, optional benefit credits, bounded wagers, lawyer appeals, and Core/Vargr undercover routes are implemented above, not part of this remaining list. This inventory is a concrete release limitation, not a claim that every possible source exception has been discovered.

### Prisoner choice clarity and compatibility

Core p. 18 later-career basic training remains followed by the regular term training roll; the UI explains both steps. Core p. 57 escape offers explicit Stealth or Deception 10+ with success, failure and decline consequences before the player acts. A new command leaves historical automatic `choose-effect` checks untouched. Frozen synthetic `.16` checkpoint and branch fingerprints verify exact mechanics/audit replay; interactive continuation, malformed and deferred rejection, both skill boundaries, restore and static/HTTP desktop/mobile tests cover the new route.

### Believer buyout

From .18 onward, Companion p. 40 Event 9 presents both player-selected payment calculations and refusal during the event. Acceptance displays forfeited accrued/current-term/rank rolls, records the exact dice and payment, and prevents lost benefits returning at exit. Refusal grants 1D Enemies and preserves advancement. The two calculation choices are an explicit player ruling, not a claim that both are unambiguous printed procedures. Legacy .16/.17 retain their original source step.

## Current event and award presentation

Result panels and the full action log show concise event context, recorded dice, possible table effects and actual character changes. Pre-career, career, mishap and nested event paths retain source references; typed decisions retain parent context. Protected-stay mishaps do not claim automatic career ejection. This presentation does not make unsupported consequences automatic or certify full rules coverage.

New characters select a required specialty when an award is received, including University level-1 awards. Level-0 awards remain unspecialized. Historical `.18` saves keep pending specialty awards and their original allocation workflow.

The GM-only Academy option is off by default. When explicitly enabled, a completed Core military Academy immediately before the first lifetime career adds one ordinary Service Skills roll only in the matching Army, Marine or Navy career. Ordinary first-career level-0 basic training and Academy graduation awards are unchanged. This is a house option, not the default rule.

### Bounded finalization equipment choices

Revision .21 automatically retains Core Armour/Blade/Gun/Weapon/Scientific Equipment/Personal Vehicle details for finalization. Awards, their source, their original career and eligible earlier award IDs remain distinct. The seven-entry Core catalogue is bounded by category, cost, TL and weapon skill; other entries remain manual. Cloth values are source-checked at Core 2022 p. 100; blade rows at p. 124; gun rows at p. 126. No combat effects are added.

Linked received-weapon skill improvements and armour trade-ins can wait with generic awards. Actual intervening skill/INT/EDU effects and the next career preserve chronological mechanical dependencies. Manual source-entered effects are included in that barrier. Independent item choices are not forced by a weapon dependency. New engine/API, import/replay, spoofing, repeated-command and static/HTTP desktop/320px popup tests cover the bounded flow. Legacy .16–.20 projections retain immediate item selection. This does not defer augmentation effects, resolve ship histories or automate all special entitlements.

Core unusual-event Alien Artefact and Ancient Technology awards are retained as generic owned objects. Their finalization popup accepts an optional name/placeholder and description, including blank/unknown, without assigning powers or value. This timing and permissive description handling follows the user ruling; source ownership and event chronology are preserved.

### Human and Vargr Psion acquisition ruling

New ruling-enabled sessions apply Aliens of Charted Space Volume 1 Update 2026 p. 256 acquisition retry and failed-attempt replacement to Human Core Psion and Vargr Psion awards. This is an explicit user ruling extending a Zhodani procedure, without its SOC 10+ table restriction or enabling deferred Zhodani creation. Core 2022 p. 229 independently permits Service Skills acquisition retries. Successful acquisition grants level 0, with all prior check penalties retained. Generic Talent improves an owned talent; when none is owned, the explicit user ruling allows choosing a common talent for another acquisition attempt, retaining all penalties. Unknown history still needs reconciliation, and zero potential/permanent loss are not bypassed. Failed acquisitions reroll their recorded original training table; fixed awards lacking a table still require an explicit replacement decision. No replacement table is invented. Legacy .16-.20 preserve their prior behavior. All newly enabled rulings share the combined .21 revision.
### Finalization ledger adapter regression
`finalization-ledgers.test.mjs` covers restricted credit category/price/quantity validation, shared balance exhaustion, replay/idempotence, retained balance, optional land descriptors and historical compatibility. `finalization-ledgers-browser.mjs` covers static and HTTP adapters at 1280px/320px, import, popup editing, over-budget recovery, repeated clicks, cancellation/reload, escaped land placeholders and print presentation. These controls do not introduce equipment combat effects or turn restricted credit into cash.

### Flat starting Luck house rule

An explicit pre-roll option, off by default, replaces the initial optional Luck 2D roll with 6. It also applies to later addition of Luck and never resets an existing Luck value. Checking the setup house rule also checks Luck; switching the house rule off preserves the Luck checkbox, while explicit later deselection remains respected. The rule consumes no dice and changes no other characteristic formula. It is a house rule, not the published Companion method. Historical histories without the option retain their original bytes and rolls. Unit coverage includes omitted/false/true, validation, generation across released species, other extras, later addition, replay/restore/idempotence and seven historical-revision digest baselines. `flat-luck-browser.mjs` covers static/HTTP at 1440/390/320, keyboard toggling, help dismissal, save/export/import/reload, repeated clicks and later addition.

### Imperial Vargr optional CHA

Campaign ruling for new revision .23: Imperial Vargr retain base SOC and generate CHA only when enabled, using exactly one 1D6 + 2 roll. The ordinary later-add command opts in with the same formula. Native Vargr CHA remains automatic. Historical .16-.22 saves and continuation preserve original results and dice consumption, including the old duplicate optional roll, with frozen synthetic replay fingerprints. Static/HTTP desktop/mobile browser checks cover selected/unselected CHA, reload/import, repeated actions and native CHA.

### GM final-score cards and PSI testing (.24)

Card edits preserve raw dice, totals, audit and deterministic replay across species bonuses, halving, swaps and Keep. PSI header information is read-only; the score opens either confirmed testing or GM assignment. New PSI remains Untested until a valid source or explicit GM value. The off-by-default house option allows standalone Core p.228 testing with teacher/timing confirmation and separate two-week/Cr5000 cost (or confirmed provider). Training remains four-month/Cr100000 and does not retest; events retain their existing rights. Unknown delayed-training decline is not automatically invented.

Native tests cover costs, lifecycle, rejection atomicity, repeat IDs, provenance, separate training and 32 frozen historical .16-.23 states/save bytes/random sequences. Static/HTTP desktop/320px browser tests cover both dialogs, keyboard cancellation, required fields, repeated submission, focus, audit and reload. Deferred Zhodani content remains outside release.
