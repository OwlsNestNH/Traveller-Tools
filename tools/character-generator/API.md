# Rules API v1

The rules engine is independent of the GUI. Import `api` from `engine/session.mjs`, or POST the same JSON to `/api/v1` on the local server. No server-side sessions are retained.

## Release boundary

`api` exposes four species (Human, Aslan, Vargr, Aezorgh) and 36 careers. Zhodani setup, careers and the Intendant/Noble PSI configuration are deferred. Direct commands, projection, import and restore/replay histories containing these choices fail with `INVALID_REQUEST`; original files remain available through unverified read-only recovery. Filtering applies equally to the in-browser and HTTP API. No request flag enables development content. Human PSI, Core/Vargr Psion and Companion paths remain supported.

The current rules revision is exported as `RULES_REVISION` by `engine/session.mjs`. Existing `.16`, `.17`, `.18`, `.19` and `.20` histories retain their recorded rules, revision, commands and outcomes on import. New sessions select required specialties immediately when awarded; `.18` saves retain their deferred-specialty workflow. The new explicit escape command requires this updated build. Current and compatible saves must also satisfy release scope. Earlier revisions, including `.15`, remain read-only recovery records. `developmentApi` and the direct engine procedures preserve full internal development coverage; they are not the public release contract. Zhodani-specific command descriptions below document that preserved, deferred implementation only.

## Operations

- `{"operation":"catalog"}` returns versioned species, career, pre-career, skill and source catalogues.
- `{"operation":"create","seed":"your-seed"}` returns a new session, projected state, empty log and revision 0.
- `{"operation":"project","session":{...}}` replays the entire session and returns state, log and revision.
- `{"operation":"command","session":{...},"command":{"type":"...","payload":{...}},"id":"unique-action-id","expectedRevision":3}` validates and appends one action.
- `{"operation":"import","raw":"...JSON save..."}` validates an exported save before returning a candidate session.

Success has `ok: true`. Invalid requests have `ok: false` and `error: {code: "INVALID_REQUEST", message: "..."}`. The HTTP adapter returns 200 or 400 respectively. `apiVersion` is reported by the catalogue. The session carries `version` as well.

## Session and concurrency

A session is `{format: "traveller-character-session", version: 1, rulesRevision, seed, events}`. Each event carries an ID, command, generated dice and summary. Commands are validated against the current stage and applied to a clone: failed actions do not mutate the supplied session. Repeating an ID with the same command is idempotent, including a retry with its original expected revision; reusing it for a different command is rejected. Send `expectedRevision` to reject stale edits. Clients must retain the returned session on each accepted command.

Limits include 2 MB UTF-8 decoded imports and serialized saves (checked before accepting an action), a bounded 4 MB plus 64 KiB HTTP envelope to allow JSON escaping, 2,000 actions, bounded text and effect lists, and a rule-effect loop cap. These are guardrails for a local tool, not a hosted multi-user security design. A production host would need authentication, authorization, rate limits and a durable storage design.

## Derived event-result presentation

Projected log entries may include `eventResults`: read-only table identity, row, original roll, concise description, possible effect summary and source reference. These fields are derived after replay validation and are not added to saved commands or summaries. Typed event decisions retain their parent context, while the normal change list records actual effects. Unknown or unsupported source outcomes remain explicit; a description does not apply a rule.

## Core command families

- Setup: `configure`, `setup`, `gm-mode`.
- Characteristics: `roll-statistics`, `swap-statistics`, `accept-statistics`, `add-extra`.
- Life path: `background`, `precareer`, `skip-precareer`, `career`, `fallback`, `training`, `survival`, `survival-check`, `career-event`, `career-mishap`, `advancement`, `commission`, `continue-career`, `change-assignment`, `qualify-assignment`, `abandon-assignment-change`, `leave-career`, `benefit`, `ageing`, `finish`.

`survival-check {}` is the interactive survival-only action. It stops at `career-event` on success or `career-mishap` on failure. The matching empty-payload action rolls that table, records its outcome summary and resolves or queues its consequences. Table actions reject from any other stage or with fabricated input. Both checkpoints export/import normally. Historical `survival {}` continues to perform the combined check/table operation unchanged so existing histories replay identically; older app builds cannot read histories containing the new commands.
- Benefits: projected typed `book-step` decisions distinguish equipment, ship, special benefit and pension rulings. `character.benefitAwards` records original entitlements separately from stable `character.assets`. `benefitRollHistory` preserves table/modifier context and duplicate-award rerolls. Use the offered fields and limits; an unconfirmed choice does not consume the award.
- Psionics: `learn-talent {talent}`, `finish-psionic-training`, `begin-psionic-training`. Projected `psionicTraining`, `psionicOptions`, `psionicCanFinish` and `canStartPsionicTraining` drive choices. Initial selection order and rolled-check count are distinct. Institute terms and unknown attempt history use typed `resolve-book` decisions; no arbitrary free retry, training or debt is implied.
- Games: `apply-psionic-games`, `psionic-games-preliminary {talent}`, `psionic-games-final`, `complete-psionic-games`. Use `psionicGamesAvailability`, `currentPsionicGames`, `psionicGamesOptions` and `psionicGamesNeedsStacking`. The replacement term is offered only at an existing-career term boundary. Completion requires `ordinaryEvents: {mode: "omit" | "resolved-externally", reason}` and, when requested, `awardStacking: {mode: "additive" | "winner-replaces-preliminary", reason}`. External events require an explicit `ordinaryEventEffects` array, even when empty. Supported effects are cash deltas, nonnegative debt additions, existing-characteristic deltas and named Contact/Ally/Rival/Enemy additions; unsupported effects reject without partial completion. The record retains frozen context, ordered checks, source decisions, benefit accounting and term completion.
- Treatment: `injury-loss {index}`, `injury-treatment {restore:{STR,DEX,END},inService}`. Projected `currentInjury`, `injuryOptions`, `injuryRestorable` and `medicalOutstanding` drive the client.
- Education: `companion-entry`, `companion-skill`, `cancel-education`, `education-event`, `education-graduation`, Core study/service choices and `preterm-commission`.
- Decisions: `choose-effect`, `choose-skill`, education-specific commands where offered, `resolve-book`.
- Record: `notes`, `connection`.
- Audit-preserving corrections: `restore`, `gm-override`, `gm-replay`. All three require GM mode.

`commissionAvailability` and `exitOptions` are authoritative action availability, with explanatory reasons. Early native Aslan retirement uses `leave-career {retire:true}`, resolves benefits, then enters `retirement` for `finish`; it does not grant an early career transfer. `followingInteractionDM` is separate from the ordinary FOL characteristic modifier.

Characteristic setup accepts `configure {aezorghTwoDice: boolean}` for the optional Aezorgh method. `statisticsRerollThreshold` and `statisticsCanReroll` are authoritative. Pool `base` is the raw retained total; `count` is the actual dice count, `formulaCount` is the destination characteristic's published count, `divisor` is 1 or 2, `derivedBase` is the post-division pre-bonus score, and `value` is the accepted-score preview including the normal minimum1 clamp. Swap raw results and their origin/boon provenance, not destination formula metadata. Standard Aezorgh use30 and their published swap groups; optional mode uses43 before placement/halving and permits all swaps.

Use the projected stage and offered options rather than guessing a valid next command. The GUI is a reference client; integration tests show complete payloads. Some beta command payloads may change before a stable release.

## Audit semantics

Projected log entries include derived `changes` with a mechanical path, before and after value. These are replayed, not independently trusted saved state. Medical bills, injuries and education awards are included.

`rolls` contains label, raw D6 values, kept values and computed total. D3 rolls keep the mapped values separately from the raw dice. Boon rolls retain the best N of N+1. The seeded PRNG is deterministic and reproducible, not a secure random service.

`restore` requires GM mode and appends a record restoring character state to an earlier revision while retaining current random state and GM setting. `gm-replay` requires GM mode and a reason; it reruns the chosen original action with one replacement roll, retains original dice before that roll, validates roll identity and count, and draws fresh dice for downstream outcomes. The current random sequence advances throughout; it is not rewound. It restores character state to that point and leaves all superseded actions in the log. Replacement values must have the original dice count and be valid D6 results. It is not an edit-in-place operation.

Import validates replay against stored dice and summaries. It does not authenticate the file's author or prove that fields were never removed or reconstructed externally.

## HTTP boundary

The local adapter binds to `127.0.0.1`, validates the Host header, rejects cross-origin requests, serves only supported local file types and exposes no write-file endpoint. It is intentionally not deployed as a public backend. The GUI can use `?api=local` for HTTP or omit it for the same in-process API.

## Rules revision and historical records

New sessions carry `rulesRevision`, equal to the engine's exported `RULES_REVISION`. `project`, `execute`, `importSession` and `exportSession` accept only current `.17` and verified-compatible `.16`; they reject missing or unsupported revisions before any action is evaluated. They never rewrite the input revision. Save format 1 alone is not a rules-compatibility guarantee. Clients must preserve rejected files and must not inject the current revision, strip audit fields or drop failing actions.

The GUI's separate read-only history inspector displays stored entries without importing or executing them. It exposes no reconstructed character state and labels the record unverified. This is recovery of recorded text, not a rules migration.

The catalog returns labels, source references and choice metadata, not the complete Companion pre-career mechanical definitions. HTTP-mode GUI requests do not import engine modules; static mode still loads them. This is transport separation, not a claim that public source files are confidential.

## Next-term transfer rights

`state.careerTransferOptions` identifies each recorded source-granted right, its target career/assignment, retained rank, current availability and any rank-track decision. The ordinary `career` command consumes a matching eligible right and records the target career index. Rights are not ordinary permanent qualification modifiers.

A Merchant-to-Navy transfer pauses at `book-step` with `pending.kind = career-transfer` and explicit `rankTracks`. Resolve with `resolve-book`, `confirmed: true`, a nonempty `note`, and `transferRankTrack: enlisted | officer`. The referee selects the source rank interpretation; generic effects are rejected. `cancel-career-transfer` returns to career selection without consuming the right. The engine validates time, assignment, career availability and source context again before entry.


## Zhodani re-education and ageing

The three stages are `reeducation-roll`, `reeducation-fine` and `reeducation-decisions`. Use projected `currentReeducation` and `reeducationRequirements`; do not construct a guessed generic effect.

- `reeducation-roll {anagathicTerms, anagathicsReason?}` records the original die and confirmed modifier. A nonzero history requires a reason; it does not establish drug access, costs or every anagathic consequence.
- `reeducation-fine {}` rolls the separate fine once. Funding remains pending when recorded cash is insufficient.
- `resolve-reeducation` accepts only required typed decisions: `rowOverride:{row,reason}`, `duration:{months,reason}`, `chronology:{mode,reason}`, `disposition:{mode,reason}`, `funding:{mode,reason}` and `endZero:{mode,reason}`. Each requirement projects its permitted values. Sub-year durations must be greater than zero and below 12 months; fractions are retained. No source ruling is selected by default.

The original modified roll is never clamped or replaced by an out-of-range row ruling. Earlier decisions survive the staged row/fine/funding flow. Treatment can precede resumption or follow the current term, as explicitly ruled; independently required career departure still applies. Protected continuation and an explicit discharge are distinct context, and contradictions require a disposition ruling.

`character.reeducations` retains source, origin, rolls, plan, decisions and timeline. `nonCareerMonths` and `treatmentAgeingTerms` are separate from career terms, training, advancement, ordinary benefits and pension service. Treatment ageing resumes its own interrupted continuation; the originating career term closes exactly once. A fatal outcome terminates further effects.

Two typed `book-step` decisions support source-limited ageing. `zhodani-anagathic-ageing` requires `resolve-book {confirmed:true,ageingAnagathicTerms,note}`; its projected limit bounds the ageing-table modifier. `zhodani-ageing-psi` requires `{confirmed:true,ageingPsiConfirmed:true,note}`. The ordinary mental-ageing choices remain available. PSI is a separate referee-confirmed option, not an automatic replacement for the Core list. Generic effects are rejected in these steps.

Age-caused PSI zero records permanent loss, preserves historical acquired talents/checks, and does not impose a PSI ageing crisis or automatic SOC reduction. Training, ordinary PSI increases and Games entry cannot silently restore lost abilities. Audited GM restore or replay can correct the originating action. Later Prole-to-Intendant elevation uses an idempotent source handler without repeating initial education or removing earlier skills.


## Merchant mishap fine

Zhodani Merchant mishap3 uses two native stages, `merchant-fine-roll` and `merchant-fine-decision`. `merchant-fine-roll {}` generates one die. `resolve-merchant-fine {decision:'pay'|'decline'}` resolves only the projected choices; payment requires enough recorded game cash and no debt or partial funding is inferred. Both commands reject unrelated payload fields.

`currentMerchantFine` exposes the active or latest source record, die, amount, origin/context, decision, payment, linked `reeducationId`, completion, `cashAvailable` and `socialStanding`. `merchantFineOptions` provides authoritative availability and reasons. `character.merchantFines` preserves the ledger across save/replay. Pending fine context blocks unrelated character changes; audited GM restore/replay remains available.

Declining at SOC9 or below enters a separate re-education episode. Its row5 fine gets its own die and funding record. Nonpayment departure and row2 permission to stay conflict unless a protected event settles the outcome; use the existing typed disposition ruling, not an assumed priority. Protected Event2 resumes its existing event continuation without another Event. Ordinary retained failed-survival mishaps close their term under the specific Core2022 p14 flowchart; the generic p18 prose does not add another Event. Prisoner keeps its explicit p52 advancement exception. Failed-survival ordinary Benefit loss is preserved.


## Zhodani constrained choices

Prole mishap5 pauses at `relationship-loss`. Projected `relationshipLossOptions` contains only eligible existing entries with their original `index`, `role` and `name`. Use `resolve-relationship-loss {index}` to remove exactly one. When the eligible list is empty, only `{absent:true,reason}` can record the referee's explicit missing-roster ruling. These forms cannot be combined. The saved `character.relationshipLosses` ledger preserves the source, originating career, original index and removed entry, or the absence ruling. Re-education follows only after that action.

Scholar distinct Science awards use `choose-skill {name}` at `skill-choice`. `pendingChoice.selected` records earlier selections and `count` is the remaining award count. Comparison is canonical and case-insensitive for distinctness. Save/import and source-limit interruptions retain both the previous choice and downstream effects. Ordinary generic skill names still follow the supported skill grammar.

Government mishap4 uses the existing `choose-effect {index}` choices for PSI, Melee or Recon. One selected check is rolled, followed by source-prescribed stay or injury handling. It does not grant an additional ordinary Event after failed survival.


## Borrowed Zhodani career results

Agent Event 9 records `character.crossCareerRoutes` while retaining the actual Agent career. Each route keeps its Investigate check, ordered borrowed Prole table results, selected assignment roll and completion. Nested Prole Events use Prole Mishaps, not Agent Mishaps. Source interruptions retain borrowed table provenance; career benefits, rank and time remain with the Agent. Death ends the route without queued training or extra career credit.

Successful routes pause at `cross-career-training` with `currentCrossCareerTraining.options`. Use `cross-career-training {assignment}` once. A failed undercover check has no assignment award. The selected skill may require a normal speciality choice before the route completes.

Government Event 4 pauses at `advisory-career`. Use the dropdown choices in `currentAdvisory.options` and send `advisory-career {careerId}`. The fixed interpretation uses another Zhodani career's Service Skills table, then its cash benefit immediately. It does not enter that career. Skills resolve before `advisory-cash`; send `advisory-cash {creditIds?:[]}` for the same selected career's cash roll.

`character.advisoryServices` records the source interpretation, origin, chosen career, service die, cash die/modifier/result, cash-roll and optional WLT changes, GM decisions and completion. The cash roll uses Gambler and explicitly selected eligible global credits, never Government rank or scoped modifiers, and does not spend an ordinary Government benefit. `benefitRollHistory` links the separate entitlement.

At the lifetime cash limit, `advisoryCashBlocked` is true and the entitlement remains saved. `resolve-advisory-cash-limit {decision:'forfeit'|'allow-extra',reason}` requires GM mode and an explicit reason. There is no default waiver or fourth roll. An override remains a GM exception to the normal cap.

An unprinted modified result pauses at `advisory-cash-source`, preserving the original die, selected credits and used cash roll. `resolve-advisory-cash-result {amount,reason}` requires GM mode, a bounded nonnegative integer amount and a reason; it does not roll or consume anything again.

## Optional one-roll benefit credits

`character.benefitCredits` retains each source-earned credit's identity, origin, value, scope, status and consumption. Core and Vargr optional one-roll Benefit DMs use these credits: unrestricted awards may be held for a later career, while explicit current-career awards expire after that career's benefits. Core Agent Event 4 and Citizen Event 8 are career-restricted; Vargr Citizen Event 5 and Intermediary Event 4 are unrestricted, with the other converted Vargr awards career-restricted. Vargr Merchant Event 3's coupled extra-roll modifier is unchanged. Deferred Prole Event 3 is global; Event 4 is restricted to the originating career's ordinary benefits. `benefitCreditOptions` gives the eligible options at ordinary benefits and advisory cash. Send `creditIds` on `benefit` or `advisory-cash` to apply only the selected credits. Omission or an empty array preserves them. Duplicate and ineligible IDs reject without mutation. Cash-source resolution, restore and replay retain exactly one consumption for the effective roll.


## Core assignment changes

At a completed term boundary, `assignmentChangeOptions` projects only the eleven Core careers explicitly classified on p. 20. Each option contains `id`, `name`, `mode` (`retain` or `restart`), `available`, `reason` and `source`. Do not infer options for alien, Companion, Drifter, Psion or Prisoner careers.

- `change-assignment {assignment}` in retain mode starts the next term with one qualification attempt. Success changes the assignment; failure keeps the old one. Both continue to ordinary training, with no new basic training, career record or rank award.
- The same command in restart mode records a voluntary change and resolves the old career's normal benefits first. The lifetime cash count does not reset.
- At `assignment-entry`, `currentAssignmentChange` identifies the saved target. `qualify-assignment {}` attempts that target using current post-benefit characteristics. `abandon-assignment-change {}` returns to ordinary career selection before the attempt and never reverses benefits.
- `character.assignmentChanges` records from/to assignments, origin career index, mode, status, source, timing, qualification result and any new career index. Each career's `termHistory` preserves the assignment and rank actually held, even after its current assignment changes.
- `character.careerTransitions` separately records source, age, generation terms, from/to career and assignment identities, mode, qualification check or automatic reason, entry/failure status and any new career index.

The retained-career path preserves career terms, officer status, highest rank and benefits. Fresh-assignment paths start a separate rank-zero career record. Applicable persistent qualification rights remain available; first-entry education, commission and rank awards are not repeated by an in-place switch. Invalid choices are rejected before dice or one-use rights are consumed. Automatic qualification, including Core Noble SOC 10+, does not invent a qualification roll.


## Native Aslan officer offers

Military Event 10 and Spacer Events 5/10 offer a specific officer career in the following term. The originating career's completed terms provide the qualification DM. `aslanOfficerOptions` exposes the actual eligible assignments, availability/reason, source, DM and whether departure needs the minimum-service waiver. The GUI must not turn that waiver into general permission to leave early.

- `begin-aslan-officer {offerId,assignment}` records the selected route and resolves the old career's benefits once. After an already-legal departure, it does not repeat those benefits.
- `aslan-officer-entry` uses `currentAslanOfficerOffer`. `qualify-aslan-officer {}` resolves the named qualification, not a Core commission or automatic transfer. Success starts a separate rank-zero career.
- `cancel-aslan-officer {mode}` accepts only projected `cancelOptions`. A waiver-only departure can end creation through retirement. An independently legal departure may return to ordinary career selection. Previously resolved benefits are retained.
- At `aslan-officer-rank`, `resolve-aslan-officer-rank {tableId,reason}` requires GM mode and an explicit choice from projected printed headers. The successful qualification remains unchanged. The saved mapping applies to that career's future rank awards. This explicit mapping step is retained for historical .16/.17 sessions. New sessions use the recorded campaign interpretation: Shipmaster maps to Pilot/Gunner, and Navigator maps to Engineer/Crew, without a GM interruption.
- An `aslan-officer-status` source step verifies a prior Outcast/Outlaw history when necessary. `resolve-book` requires GM mode, `confirmed: true`, `aslanOfficerStatusApproved`, a source-basis `note`, and `aslanOfficerStatusConfirmed: true` for approval. Approval applies only to this offer. Denial does not leave the old career, roll qualification or consume benefits.

`character.aslanOfficerOffers` retains the grant boundary, source/origin career, selected assignment, completed-term DM, commitment, check, cancellation, rank mapping and `statusVerification`. Forced stay is not waived; unused offers expire if another term intervenes. Ordinary forced exit does not itself disqualify the offer.

`character.aslanStatusChanges` records source, timing, SOC/status before and after, removed Clan Share tokens and affected award IDs. Native Aslan qualification failure sets SOC 2/Outcast and forfeits held unconverted Clan Shares, including those just received during mustering out. Original award records remain annotated rather than erased. Other benefits and cash history are preserved. No repossession of previously redeemed cash, ships or land is inferred.

Native Aslan cash limits and male half-cash handling remain distinct from the Core three-roll rule. Broad Hierate/Core access and generic same-career Aslan assignment mapping remain outside this bounded route. The separate land-claim workflow is documented below. Native origin setup is documented separately below.

## Earned Aslan Outcast restoration

Outcast Event 11 opens a typed `book-step` with `pending.kind = aslan-restoration`, not a generic characteristic edit. `currentAslanRestoration` is the pending/latest ledger record.

- `resolve-aslan-restoration {accept:false}` declines without requiring GM mode.

- Acceptance requires GM mode and `{accept:true,originalSOC,originalSOCConfirmed:true,statusTiming,reason}`. Original SOC is a verified integer from 1 through 40 (the engine representation limit, not a normal source roll range); the nonempty reason is at most 500 characters. Neither is guessed or prefilled.

- `statusTiming` is an explicit referee ruling: `on-restoration` or `on-successful-entry`. SOC restores on acceptance; clearing current Outcast status follows that recorded ruling.

- The earned right permits one normal next-term career attempt, not automatic qualification, retained rank, a free term or a permanent historical career unlock. `aslanRestorationNotice` projects its availability and reason. Continuing Outcast expires it; forced stay and independent entry conditions remain binding.

- `character.aslanRestorations` records the source, original career/time boundary, SOC/status before and after, typed decision, actual career attempt/check and expiry. Previous forfeitures remain historical; restoration does not return lost Clan Shares.

Voluntary native Outcast entry sets Outcast status and forfeits held unconverted Clan Shares without inventing the SOC 2 penalty that applies to qualification failure. Its separate Outlaw procedure is described below.

## Earned Aslan Outlaw restoration

Outlaw Event 11 opens `book-step` with `pending.kind = aslan-outlaw-restoration` and `currentAslanOutlawRestoration`. Generic source effects cannot complete it.

- Male `resolve-aslan-outlaw-restoration` uses `{decision:"restore",originalSOC,originalSOCConfirmed:true,reason}` and requires GM mode. Original SOC is a verified integer1–40 and reason is1–500 characters. Present Outcast status clears before three Clan Shares are awarded, so the new award is not immediately forfeited. The printed imperative is not given an invented optional decline.

- Female acceptance uses `{decision:"marry",unmarriedConfirmed:true,reason}` and requires GM mode. It rolls fresh normal2D SOC, with no statistics boon or SOC species modifier, records the accepted marriage and clears current Outcast status. It grants no male Clan Share award.

- Female `{decision:"decline"}` requires no GM mode and leaves SOC/status/term unchanged. `{decision:"ineligible",unmarriedConfirmed:false,reason}` requires GM mode to record known ineligibility. Missing marital history never implies eligibility.

- Accepted paths require departure and finish the existing term once, including any due ageing, followed by the old career benefits once. They do not award a free extra term, qualification, rank or automatic new career. `character.aslanOutlawRestorations` retains the original source/time boundary, before/after values, decision, exact SOC dice, share award IDs, marriage and departure. The career records `aslanRestorationExit` provenance.

### Separate historical career access

The restored-standing result does not explicitly grant the Outcast event's next-term entry permission. The interface therefore requests a separate referee interpretation for a specific next native Aslan career and assignment. It is never presented as an automatic source grant.

- `aslanHistoricalEntryOptions` projects `{careerId,name,assignments:[{id,name,available,reason}],available,reason,restorationId}` at the completed restoration departure boundary.

- `request-aslan-historical-entry {careerId,assignment}` opens `book-step` with `pending.kind = aslan-historical-entry` and `currentAslanHistoricalEntry`, including the requested labels. It rolls no dice. A different request explicitly supersedes any unused approval, retaining its history.

- GM-only `resolve-aslan-historical-entry {approved,reason}` records approval or denial. Approval permits only the requested ordinary qualification attempt; it does not bypass other prerequisites or roll qualification immediately. The normal `career` command consumes it. Failure uses normal SOC2/Outcast/forfeiture and source fallback.

- `character.aslanHistoricalEntries` retains requested route, source, restoration ID, timing, prior career indices, decision, actual check, expiry and supersession. Another career, education or elapsed boundary expires an unused ruling. There is no permanent historical unlock, stockpile of approvals, reused benefits or silently retargeted decision. Existing officer-offer status reviews remain offer-specific.

Family origin procedures are documented below. The land-claim workflow is documented below; inheritance and general Hierate/Core access remain separate work; these bounded restoration paths do not certify complete Aslan generation.

## Native Aslan family and origin

Accepted final statistics create `character.aslanOrigin`. `familySOC`, `initialStats` and `statPool` preserve the initial accepted placement, species modifiers and roll provenance. Later personal SOC changes do not rewrite this history. Family awards supplement the ordinary background allowance. Family, birth, clan, scope, pride and rite rolls do not receive the characteristic boon option or enter the six-stat reroll total.

Use `currentAslanOrigin`, including its projected `estateOptions`, `canRollGender` and `sourceDecision` fields. It exposes decisions and recorded results, not full source tables. The native sequence is:

1. `aslan-family`: `roll-aslan-family {}`. If gender was unspecified, `roll-aslan-gender {}` first uses the source roll. An explicitly different identity is never randomly replaced.
2. Resolve any supplemental family skill choices. `aslan-birth-order` then uses `roll-aslan-birth-order {}` for males. Daughters require no invented birth-order roll.
3. `aslan-estate`: `resolve-aslan-estate {method:"printed-minimum"}` records the printed baseline with `ownership:"unestablished"`. The overview's unspecific instruction to roll land does not invent a die absent from the detailed table. Below the printed estate range, the recorded minimum is null, not a zero-sized owned estate. An out-of-table SOC uses GM `method:"referee-baseline"`, nonnegative integer `parcels` and `increment`, and a source `reason`.
4. `aslan-clan`: `roll-aslan-clan {}` records clan dice and any conditional scope die. Alternatively, GM `choose-aslan-clan {name,scope,reason}` records a referee-selected clan. Name is 1–80 characters; descriptive scope is 1–160. Both retain provenance.
5. `aslan-pride`: optional `name-aslan-clan {name}` records only a descriptive name. `roll-aslan-pride {}` records the separate pride roll.
6. Ordinary `background {skills}` consumes the unchanged background allowance, then `aslan-rite` uses `roll-aslan-rite {}`. Doubles may require normal typed effect/skill continuations before origin completion and pre-career choices.

`book-step` with `pending.kind:"aslan-origin-source"` requires `resolve-aslan-origin-source`, not generic effects. All such rulings require GM mode and a 1–500 character reason:

- `sourceDecision.kind:"family-band"`: `{band,reason}` for the unprinted initial family SOC, using only projected choices.
- Legacy `.16`/`.17` only, `female-independence`: `{decision:"omit"|"grant-level-zero",reason}`. The level-zero grant is explicitly a referee exception to the gender restriction, not an invented substitute award.
- `gender`: `{gender:"male"|"female",reason}` selects the published mechanical branch. `character.identityGender` and `aslanOrigin.identityGender` retain the original choice; `character.gender` remains the engine's mechanical field. Clients display the identity separately from the source branch.

Source decisions retain their own ledger. Estate inheritance eligibility does not prove present ownership, grant an asset, pay cash or advance time. Initial Outcast family classification does not fabricate previous career service. Restore and replay remain explicit audited operations; origin history is not silently corrected by later SOC edits. The original-SOC fields in earned restoration events remain deliberate referee inputs, not automatically filled from family SOC.

This increment does not redeem Clan Shares, establish an inherited estate's current title, implement corporate investments or finish all Hierate/Core access rules.


## Clan Share lots and exchanges

`state.clanShareOptions` projects the total and usable balances, safe-checkpoint availability, held lots, known clans, eligible choices and matching Contacts. Use its `choices[].lotIds` and `contacts[].eligibleLotIds`; do not infer eligibility from names. Lots retain original `awarded`, current `available`, `spent` and `forfeited` quantities, with the invariant `awarded = available + spent + forfeited`. An award's original quantity is never rewritten into its remaining balance.

- `redeem-clan-shares {kind,inputs:[{lotId,quantity}],name?,relationshipId?}` accepts `cash`, `ship-shares`, `contact` or `ally`. Inputs identify exact held lots and positive integer quantities. The GUI deliberately offers one lot per exchange; the API can combine valid lots. Cash is a female source option at Cr10,000 per share; Ship Shares exchange one-for-one and retain the Core no-cash restriction. Neither exchange requires a named issuing clan once the quantity is verified.
- A Contact or Ally favour costs exactly one share and requires a known issuing clan. `contact` requires a nonempty name; `ally` requires the stable ID of an existing, verified upper-echelon Contact of that same clan. The role changes on that existing entry, not on another same-name person.
- `verify-clan-share-lot {lotId,reason,clanId? | newClanName?}` requires GM mode. Omitting both issuer fields explicitly verifies only the recorded source quantity while leaving its clan unknown. Identifying a clan uses either an existing ID or a nonempty new name, never both. Verification grants no quantity and does not rewrite source-earned provenance merely because its clan needed verification.
- `verify-clan-contact {relationshipId,clanId,reason}` requires GM mode and confirms the existing Contact's upper-echelon affiliation. It neither creates a person nor upgrades their role.

Exchanges are optional. The preview permits them at clean `precareer`, `career`, `term-end`, `retirement` and `finish` checkpoints, not during unresolved or reserved procedures. This is a safe interface boundary, not a claim that the book imposes a spending deadline. Use `checkpointAvailable`, the projected reason and per-choice availability. No exchange changes age, generation terms, career, ordinary benefit count, lifetime cash-roll count or WLT, and no dice are rolled. Before `finish`, new cash participates in normal medical settlement. After `finish`, debt and the previous settlement remain unchanged.

`character.clanShareLots`, `clanShareClans`, `clanShareVerifications` and `clanShareRedemptions` retain issuing/source evidence, stable IDs, exact inputs, outputs, before/after balances and action context. Qualification/status forfeiture consumes only the still-held part of each lot and records exact affected quantities. Previously exchanged cash, Ship Shares and relationships are not repossessed. Source-earned Outlaw shares with unknown clan can still become cash or Ship Shares; clan favours require the additional affiliation record.

The always-on audit includes these ledgers and stable relationship identities. Replay/import uses the current rules revision; `.10` files are not automatically migrated. Corporate equity and cross-character pooling are not implemented by these commands. Land uses the additional workflow below. Male assets use the additional commands below.


## Male Clan Share assets

The same `redeem-clan-shares` command supports two male-only choices. `state.clanShareOptions.assetRules` supplies the per-share value, text/quantity/price/TL bounds and GM requirement; it is null for female source rules. Art/weapons choices are absent for females. These are software input bounds, not invented source limits. The UI displays assessed value separately from liquid cash.

- `kind: "art"`, normal lot `inputs`, and `name` create one described personal art holding with assessed value equal to the selected shares times Cr10,000. No GM mode is required for this source-derived value. It does not assert a resale price.
- `kind: "weapons"`, normal lot `inputs`, `items: [{name,quantity,unitCost,tl,sourceReference}]`, `sourceConfirmed: true` and a nonempty `sourceReason` require GM mode. The referee verifies the actual equipment, prices, technology and total. This does not claim that the software checked a source equipment catalog. Each item row becomes a separate stable asset containing its quantity.
- Exact-value bundles need no extra ruling. An under-budget bundle requires `lowerValueAcceptance: {confirmed:true,reason}`. This is an explicit referee exception that records the lower assessed value and surrenders the unused value; it does not create cash, credit or a reusable entitlement. Without it the command rejects atomically and the original shares remain held. A lower-value ruling on an exact-value bundle also rejects.
- Over-budget bundles, cash supplementation, unsupported fields, absent source confirmation, invalid item values and female attempts reject before any lot is spent. A weapon with no positive listed price or no numeric TL is not silently assigned a value.

`character.assets` retains IDs, definition/source, original award IDs, personal ownership, redemption ID, category, quantity, assessed value, valuation basis and verification provenance. Weapon assets additionally retain unit cost, TL and source reference. `sourceVerification.method` distinguishes `source-derived` art from `referee-confirmed` weapons; the latter records `catalogChecked:false`. Redemption outputs include `assetIds`, `budget`, `assessedValue`, `unusedValue`, `unusedValueDisposition` and any lower-value ruling. The always-on audit captures both assets and the original lot debit.

These are non-cash assets, so they cannot silently fund medical settlement, repay debt, consume cash-roll allowance, change WLT, advance time or grant weapon skills. Later Outcast forfeiture affects still-held shares, not the converted assets. This path neither applies male cash-roll halving nor borrows ordinary Core Weapon-benefit price/TL limits or repeat-award skill options. Automatic resale and corporations remain unfinished. Land uses the separate delayed-claim workflow below.


## Aslan land claims and holdings

Aliens Volume 1 Update 2026 pp. 17 and 47. This separate workflow creates a delayed claim first, not an immediately owned estate. It neither changes the family estate baseline nor decides inheritance.

- `redeem-clan-shares {kind:"land",inputs:[{lotId,quantity},...],world:{name,location,reference?},parcelRuling?}` requires the male source branch, current SOC 9+, a clean generation checkpoint and at least three genuine shares. Multiple lots can combine. Unknown issuing-clan identity does not invalidate a source-verified quantity. Every lot retains original award provenance and exact debit.
- The caller selects an identifiable world: name 1–120 characters, location 1–160, optional reference 1–160. No world catalog is checked and no UWP, parcel area or land quality is inferred.
- Current SOC determines the printed minimum and per-extra-share increment. The accepted record freezes both and its resulting parcel count. A current SOC outside the printed range requires GM `parcelRuling:{minimumParcels,increment,reason}`; minimum is a positive exact integer, increment is nonnegative, reason is 1–500 characters. It does not reuse a historical family baseline. An override of a printed row is rejected. Software exact-integer bounds are not published land limits.
- After validation, one normal D6 plus 3 records delay years and eligible chronological age. It does not receive characteristic boons or advance time. Nonstandard delay exceptions are not implemented. A GM replay can replace the original D6 within its valid range, preserving superseded audit history.
- `state.clanShareOptions.landRules` projects the current single-row calculation and input bounds; its land choice projects eligible lot IDs and its reason. The GUI can combine selected lots and displays only the current calculation, not the source table.
- `state.landClaimOptions` is separate from the unspent-share balance. Each claim projects maturity, remaining years, checkpoint eligibility and permitted modes. A converted claim is not automatically resized, cancelled or repossessed after later SOC loss or Outcast status. New redemption still has its own eligibility checks.
- `resolve-land-claim {claimId,mode:"personal-return"|"relative-administration",claimEstablished:true,reason,relativeName?}` requires GM mode, elapsed recorded delay and a clean checkpoint. Relative administration additionally requires Independence 3+ and a named relative, maximum 120 characters. Both modes need explicit confirmation and a 1–500 character reason that the actual claim has been established. Appointing a relative alone does not establish title. Personal return rejects an irrelevant relative field. No travel, time, cash, skill or career progress is invented.
- Resolution creates an active personally owned `aslan.landholding` asset with category `land`, the selected world, parcel count, original SOC, source award IDs and administration evidence. It has no equipment stats or cash valuation. `character.landClaims` preserves original inputs, world, source, SOC, parcel calculation, delay dice/timing, pending/claimed status, resolution and asset link. All are audited before/after. Pending claims and owned holdings have a dedicated printed sheet section, separate from equipment and the family estate.

Repeated command IDs, import, restore and replay follow the ordinary deterministic audit contract. The current rules revision is `character-preview-2026-11-09.17`, with `.16` explicitly supported for unchanged replay and continuation; `.15` and earlier files are unverified read-only recovery records, not silently migrated. Corporations, inheritance timing, nonstandard delay exceptions, land valuation/income and broader alien-access gaps remain unfinished.


## Native Aslan outward career access

Aliens Volume 1 Update 2026 pp. 22, 29, 35 and 41; ordinary Core qualification and benefits remain distinct from native upbringing.

- Actual Outcast or Outlaw career history restricts respectable native Aslan careers, whether or not a restoration record exists. A family-background Outcast label is not career service. Existing restoration, officer and approved historical-entry exceptions remain scoped to their original target and source boundary.
- Source-earned Scientist Mishap 6 offers one next-term automatic Scholar attempt after legal departure and the original benefits. An accepted Outcast Event 9 expedition instead requires an ordinary Core-career qualification attempt next term. It preserves the current Event’s advancement. Neither route silently waives protected stay, minimum service, due ageing or old benefits.
- The p. 22 history route permits Core career access outside Aslan space. Current Outcast status without that career history has the narrower Rogue/Drifter scope. A failed native qualification permits only a no-check outward Drifter fallback, never a second qualification or draft in that same term. Corporate-employment permissions are not implemented by this route.
- `state.aslanAccessOptions` projects source, availability/reason, target career IDs, whether entry is automatic and whether the next attempt is mandatory. The GUI displays these choices and their source reference without importing engine rule packs. `state.aslanAccessRules` supplies destination and reason limits.
- `activate-aslan-access {routeId,destination,confirmed:true}` records a 1–160 character destination at a clean career boundary after the original career and benefits. No GM is needed for a printed route. It changes no identity, upbringing, statistics, skills, age, rank or prior benefits and does not simulate travel. `character.aslanCareerContext` separately records region, active/established/expired status, access ID, destination, exact career scope and source. A narrow route does not silently authorize unrelated Core careers.
- The ordinary `career` command consumes a next-term right on its actual attempt. `character.aslanCareerAccess` retains origin career/assignment, granted/available term boundary, scope, activation, actual check/result and expiry. Optional unused rights expire on the documented chronology, education, other-career and next-term boundaries; rejected actions consume no rights, dice or education opportunities. `c.aslanAccess` projects an applicable automatic right so the interface does not misleadingly request an ordinary qualification roll.
- A failed outward Core qualification follows Core Drifter/draft handling and does not newly impose native SOC 2, Outcast status or Clan Share forfeiture. `state.fallbackOptions` supplies the authoritative fallback and draft labels, availability and reasons. The lifetime ordinary draft limit still applies. `state.finishOptions` and existing education/training/continuation projections prevent bypassing a mandatory expedition.
- Manager Mishap 2’s accepted true accusation retains its specifically required next Outcast career. Broader outward routes cannot replace that source mandate.
- If expedition timing conflicts with a natural-12 forced stay, `state.aslanAccessConflict` projects the genuine conflict and two source-precedence choices. GM `resolve-aslan-access-conflict {decision,reason}` explicitly selects `honor-forced-stay` (keep the forced term, expire the expedition) or `honor-expedition` (retain the expedition, waive only this conflicting forced stay). The 1–500 character reason, original roll and chosen precedence are preserved. There is no default.

### Separate Aslan and Core muster-outs

The configured ruling resolves the original native-career benefits under Aslan rules before departure. Each outward Core career then uses Core benefits, full Core cash amounts and its Core pension rules when that career later ends. Native upbringing and native ageing thresholds remain unchanged. No benefits are repeated or retroactively reinterpreted.

Each outward Core record carries `aslanOutsideRules` with its source-access ID and applied career, benefits, cash, pension and ageing systems. `character.cashRollAccounts` separates native and Core rolls; initialization reconciles existing completed Core cash history rather than assuming zero. Prior native cash rolls do not consume the Core lifetime allowance of three. Core cash usage persists across later Core careers. `state.cashRolls` remains the total actual count; clients must use `state.cashRollAccounting.used/limit` or `cashRollsUsed/cashLimit` to enable the active cash choice. The projected account includes a display name and the total. WLT changes only once for each actual cash roll.

The action audit includes route scope, activation/attempt/expiry, context, per-career applied rules and separate cash accounts. Rules revision `.14` rejects earlier saves for verified replay while preserving their original unverified read-only history. General Aslan assignment rank mapping, corporate employment, the Outcast Event 10 Wanderer prerequisite question and broader cross-book gaps remain outside this bounded increment.

For limited Aslan outward rights, failed scoped Scholar qualification permits the ordinary Drifter fallback only. It does not enable elective wider Core careers or the Core draft.

### Bounded Vargr training awards

Vargr Loner Event 4 (Aliens 2026 p. 195) opens an assignment-only skill choice. Agent, Intermediary, Merchant, Scientist and Spacer advanced-training events (pp. 189, 193, 197, 203, 205) open a choice limited to skill entries on tables currently available to that career and assignment. EDU prerequisites still apply. Characteristic entries and other assignments are excluded; an explicitly named speciality cannot be exchanged for another speciality.

The pending `skill-choice` includes `tableSkills`, `trainingContext` (career, assignment, eligible table IDs) and the event `source`. `choose-skill` validates against that recorded set, uses normal skill caps and consumes no dice. Source resolution and retry retain the constraint and source. Citizen Event 4's one-off Advanced Education waiver is native and never changes later eligibility.

### Optional benefit wagers

At `benefit-wager`, `resolve-benefit-wager` accepts `{stake: 0}` to decline, or `{stake: positiveInteger, skill: "Gambler" | "Broker"}` within the pending source’s permitted skills and maximum. Other fields, future benefits and unrelated mutations are rejected. `character.benefitWagers` retains source, career/index/assignment, accrued balance, stake, selected skill, check and resulting balance. The pending queue resumes the original advancement/other continuation exactly once. Merchant skill-cap conflicts use the existing explicit source-resolution boundary.

### Core and Vargr undercover routes

Core Agent Event 8 (Core 2022 p. 23) and Vargr Agent Event 9 (Aliens 2026 p. 189) pause at `cross-career-cover`. Read `currentCrossCareerCover.options`, then send `cross-career-cover {careerId}`. The choice is recorded before the Deception 8+ check and cannot include fabricated dice or another career/table field. The selected cover remains distinct from the actual Agent career in `character.crossCareerRoutes[].coverCareerId`.

Core cover options are Rogue and Citizen. Success rolls that cover's Event table, then pauses at `cross-career-training`; failure rolls only its Mishap table. Vargr success rolls no Event: it grants one chosen cover specialist-table roll, followed by DM+2 to the originating Agent's next advancement. Failure rolls the cover Mishap. Specialist choices use the existing `cross-career-training {assignment}` command, with options projected from the chosen cover, not the Agent assignment.

The bounded Vargr cover set is the eight other native Vargr careers plus Core Drifter, which Aliens p. 186 expressly makes available. Qualification, entry restrictions, prior service and rank are not applied to a cover identity, and Psion cover does not itself grant PSI or institute access. The phrase “another career” does not define cross-cultural or optional Companion cover eligibility. Broader covers need a referee/source ruling and are not silently enabled by this implementation. Core Agent Event 8 retains its explicitly named two-career scope regardless of upbringing.

Borrowed tables retain their printed source pages, nested choices and source-assisted interruptions. They do not create another career record, rank, term or benefit schedule. A Mishap uses existing ejection/stay semantics; unlike the preserved Zhodani route, these events do not add a blanket protected-stay override. A nested Event with an explicit stay exception retains it. Death cancels queued specialist training and advancement awards. Check, table and selected training records survive save/import and GM replay; request IDs retain normal idempotency semantics.
### Prisoner Event 9 lawyer (Core Update 2022 p. 57)

The native event produces `pending.kind: "prisoner-lawyer"` and a pending `character.prisonerLawyers` audit entry. Resolve it with `resolve-prisoner-lawyer {outcome: "decline"}` or `{outcome: "hire", level: <nonnegative integer>}`. A hire requires existing cash for Cr1000 × level², then rolls 2D + the lawyer's Advocate level against 8. Only success rolls the 1D parole reduction. Parole Threshold can fall below zero; the printed rule imposes only a maximum of 12 (Core p. 52). Release is still decided by the normal Prisoner advancement check, not the lawyer decision itself. No Traveller skill, characteristic DM, loan, subsidy, or Contact is added.

The creation limit on increasing the Traveller's skills does not cap an external lawyer's Advocate level. Positive levels are bounded by affordable cash and exact credit arithmetic. The printed formula costs zero at level 0; because eligibility of a level-0 lawyer is not specified, that selection additionally requires `zeroLevelConfirmed: true` and a nonempty `reason` recording the referee's ruling. This is not silently offered as free funding. Other fields, funding substitutions, stale opportunities and context-changing commands reject atomically. Restore/replay and matching-revision import retain the audited decisions, cash, dice and continuation.

### Core life events

Core life and unusual events use deterministic secondary dice and source records. Pending typed decisions use `resolve-life-event` with `confirmed: true` and a nonempty `reason`. Fields are restricted to the pending decision: narrative `outcome`; ending/betrayal `role` plus new `name` or exact existing `relationshipId`; artefact `name`; Crime `outcome` (lose-benefit/prisoner); institute `outcome` (decline/test), with testing funding, cost and timing confirmation. No artefact powers, free training or extra generation term are invented. Prisoner transfer occurs after current-term advancement. Benefit rolls can select distinct `lifeBonusIds` for available +2 Good Fortune bonuses.

### Explicit manual boundaries

A generic source step applies only its supported entered effects. Notes and confirmation do not automatically apply future roll modifiers, career permissions, transfers or other unimplemented consequences. These require separate referee bookkeeping. In particular, manual/over-cap disposal of the Aslan skirmish skill award keeps its required check as a separate source step; a successful external check's advancement DM is not automated in that manual branch. The native successful-award branch checks the exact awarded specialty. Save/export preserves original commands and source notes.
### Source relationship consequences

`resolve-relationship-event {confirmed:true,relationshipId?,role?,name?}` resolves the `relationship-event` checkpoint. Drifter, Entertainer, Rogue, Psion, Aslan Outcast and Aslan Outlaw use exact existing relationship IDs, including when names repeat. Change rows require one listed destination role; existing names and IDs are retained. Removal accepts neither role nor name. No existing eligible person may be bypassed with a newly named person.

For an empty roster, the printed Drifter/Entertainer/Rogue/Outlaw replacement permits an optional name and requires the printed role choice. Outcast instead applies its printed loss of this term's Benefits on confirmation. Psion's missing-person case has no printed replacement and remains an explicit source step. Zhodani loss behavior is unchanged. The `relationshipEvents` ledger records source, career, age, term count and before/after identities; restore/import replay the command history.

### Constrained talent and Truther awards

Core Psion service result 6 (Core 2022 pp. 229, 236) selects a common talent. A known talent improves normally; an unacquired talent enters the same ordered acquisition/retry procedure as named service rows. Previous checks, unknown-history decisions and failed attempts remain intact. Rank awards still improve only acquired talents.

Companion Truther Event 5 (p. 37) permits an Electronics or Science speciality not explicitly possessed, including rejection of an explicitly possessed level-0 speciality. A different speciality remains eligible despite general level-0 familiarity. Event 9's skill branch grants two levels in one Science/Electronics speciality or Medic, with level-4 and total-skill caps. Its queued Enemy award follows the selection.

Vargr Psion Event 6 (Aliens 2026 p. 201) permits a non-psionic skill, excluding talents and psionic subjects (including aliases, case-insensitively). Native Science awards use the non-psionic specialities listed in Core p. 71. Unclassified Science subjects pause without an award for an explicit source eligibility decision; retry preserves the original constraint. Event 8 retains its PSI 10+ check and failure skill award. Success grants a new common talent at level 0 (the Core p. 228 talent-learning baseline), without another acquisition check. The source grant is recorded separately from acquisition attempts, preserving the previous-check penalty and unknown-history status; a first talent has now been chosen. All-talents-known, absent potential and permanent psionic loss remain explicit source boundaries.

## Prisoner escape selection

`state.prisonerEscape` appears only for the exact active Core Prisoner Event 3 choice and contains Stealth/Deception skill levels and check modifiers. `prisoner-escape` accepts only `{skill: "Stealth"}` or `{skill: "Deception"}` and rolls the chosen skill against 10. Invalid or stale commands reject atomically; duplicate action IDs do not roll again. `choose-effect` index 1 still declines without a roll. Original `choose-effect` index 0 remains unchanged for historical replay. Source: Core 2022 p. 57.

### Believer event 9

New sessions expose the buyout through the ordinary `effect-choice` stage and `choose-effect {index}` command. `pendingChoice.buyoutPlan` records the accrued/current-term/rank components, owed loss IDs, total forfeited rolls, and payment range. No decision is preselected. Acceptance records `career.believerBuyout`, adds its cash payment, closes the term and requires career exit with no restored forfeited benefits. Refusal keeps the career and rolls 1D Enemies. The choice is available in player mode; replay/import and duplicate command IDs preserve the decision and payout. Historical .16/.17 choices and manual source resolution remain unchanged.

Believer event 9: the player chooses either one 2D roll multiplied by Cr10,000 and the forfeited roll count, or separate 2D rolls per forfeited Benefit roll, summed and multiplied by Cr10,000. Both acceptance options leave the career; refusal gains 1D Enemies. The recorded calculation shows every result, formula and total. This calculation choice is an explicit player ruling; legacy .16/.17 source-resolution is unchanged.

### Female Aslan Independence ruling (.18)

The user ruling of 2026-11-09 rerolls a mandatory Independence result from the same source table, retaining all dice and modifiers. Family Outcast row 4 rerolls before any award; the accepted row supplements ordinary background skills. Material-benefit replacements (including borrowed-ship rerolls) consume only the original benefit entitlement. Printed gender substitutions and legal choice alternatives remain available; male-only choices retain their original indices but are unavailable with a reason.

Each reroll sequence is limited to 64 candidate rolls; exhaustion rejects the entire action without committing a partial award. Fixed or event awards without an originating rerollable table remain explicit source decisions. This is a user ruling, not newly claimed printed text. Historical `.16` and `.17` mechanics are unchanged.

### Optional first-career Academy Service Skills roll

With GM mode enabled, send `gm-academy-training` with `{enabled: true|false}` before entering the first career. The option is off unless explicitly enabled; its change is recorded in the action log and participates in restore/replay. The UI label is **Allow Service Skill choice in the first term after Academy**.

After a completed Core military Academy term immediately preceding the first lifetime career, enabling this house option adds one ordinary Service Skills roll after basic training and any graduation awards. It applies only to the matching Army, Marine, or Navy career and does not double later-career training. The roll uses ordinary skill gains, specialization choices, and limits. The option does not change the default full first-career level-0 basic training, including Army's Drive-or-Vacc Suit choice; minimum-level-0 awards do not stack. Existing saves without the new command retain their original behavior.

### Borrowed event roll checkpoints

`cross-career-cover-check` and `resolve-relationship-event-step` are the UI's separated-step variants of the original commands. Their original equivalents remain replay-compatible. A pending `borrowed-event-roll` exposes `pendingBorrowedRoll` with `id`, `label`, `kind`, `dice`, and `source`. Submit `roll-borrowed-event` with exactly `{pendingId: pendingBorrowedRoll.id}`. Each token authorizes only that current roll; a later token cannot be consumed by retrying an earlier request. Source/skill prerequisites may suspend without rolling. Export/import, request IDs and expected revisions preserve pending checkpoints. New `.20` sessions enable separation by default; explicit variant commands enable future separated routes in compatible older saves without changing their revision or recorded actions.

## Generic equipment awards (.21)

Supported ordinary Core equipment awards automatically create an individual pending record in character.deferredEquipment, not a fabricated asset. Records retain awardId, source selection limits and eligible earlier award IDs. Weapon-improvement records retain their original effect and source award; they grant no skill until resolved.

Use review-equipment at a supported benefits/career checkpoint, or finish between careers, to enter equipment-finalization. choose-deferred-equipment takes {id}; linked prerequisites must be resolved first, while independent awards can be opened in any order. The existing typed resolve-book fields resolve an item. Optional benefitItemId selects a filtered canonical catalogue item; inconsistent supplied name/cost/TL/skill metadata is rejected. Custom entry remains available. cancel-deferred-equipment closes an uncommitted finalization popup; close-equipment-finalization returns to the prior checkpoint. Completed linked skills use ordinary choose-skill validation and source fallback.

A mechanical dependency can temporarily resolve only the relevant earlier weapon details and improvement before resuming the original queued effect or source command. Merely having generic equipment does not prevent another career. Repeated request IDs are idempotent; saved state is derived by validated command replay, not trusted serialized queue fields. Deferred Zhodani release scope is unchanged.

### Finalization ledger commands
`resolve-landhold-details` accepts optional `name` and `location` strings for the selected landhold. `spend-equipment-credit` accepts `category`, optional canonical `itemId`, custom `name`, `unitCost`, positive integer `quantity`, optional `techLevel`, `sourceNote`, and `confirmed: true`; canonical metadata cannot be overridden. It debits only the selected restricted credit and creates a linked asset, leaving the popup open. `retain-equipment-credit` closes that task while retaining unspent credit. All use existing command-ID replay/idempotence and finalization cancellation semantics.

## Adjustable minimum raw total

The `configure` command accepts optional `minimumTotal`, an integer from 6 through 72, before any statistics rolls. It overrides the raw-total threshold without changing dice, placement, modifiers, or `minimumReroll`. The projected `statisticsRerollThreshold` is authoritative. Omitting `minimumTotal` preserves the existing species/method default (30 for standard Aezorgh, 43 otherwise) and legacy config/save shape. The option is saved and replayed with its command.

### Flat starting Luck option

`configure {flatLuck: boolean}` selects the optional flat starting Luck rule before any base characteristic roll. Omitted or `false` means normal 2D Luck. `true` means initial LCK is 6, with no roll or RNG consumption, both in `accept-statistics` when LCK is selected and in `add-extra {id:"LCK"}` later. The engine option does not select LCK itself, change other extras, or reset an existing score. The setup UI checks the LCK selection when the user checks the house rule; switching the house rule off does not clear that selection. It is independent of GM correction mode. Invalid non-booleans and changes after rolling are rejected atomically.

The additive option does not bump `rulesRevision` or add a default key to historical config. Configure summaries mention it only when explicitly submitted; old histories without it replay unchanged. Histories using it require this updated implementation. `verification/flat-luck.test.mjs` compares historical `.16`–`.22` exported bytes against SHA-256 baselines from the prior implementation.
