# Rules API v1

The rules engine is independent of the GUI. Import `api` from `engine/session.mjs`, or POST the same JSON to `/api/v1` on the local server. No server-side sessions are retained.

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

## Core command families

- Setup: `configure`, `setup`, `gm-mode`.
- Characteristics: `roll-statistics`, `swap-statistics`, `accept-statistics`, `add-extra`.
- Life path: `background`, `precareer`, `skip-precareer`, `career`, `fallback`, `training`, `survival`, `advancement`, `commission`, `continue-career`, `change-assignment`, `qualify-assignment`, `abandon-assignment-change`, `leave-career`, `benefit`, `ageing`, `finish`.
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

Use the projected stage and offered options rather than guessing a valid next command. The GUI is a reference client; integration tests show complete payloads. Some preview command payloads may change before a stable release.

## Audit semantics

Projected log entries include derived `changes` with a mechanical path, before and after value. These are replayed, not independently trusted saved state. Medical bills, injuries and education awards are included.

`rolls` contains label, raw D6 values, kept values and computed total. D3 rolls keep the mapped values separately from the raw dice. Boon rolls retain the best N of N+1. The seeded PRNG is deterministic and reproducible, not a secure random service.

`restore` requires GM mode and appends a record restoring character state to an earlier revision while retaining current random state and GM setting. `gm-replay` requires GM mode and a reason; it reruns the chosen original action with one replacement roll, retains original dice before that roll, validates roll identity and count, and draws fresh dice for downstream outcomes. The current random sequence advances throughout; it is not rewound. It restores character state to that point and leaves all superseded actions in the log. Replacement values must have the original dice count and be valid D6 results. It is not an edit-in-place operation.

Import validates replay against stored dice and summaries. It does not authenticate the file's author or prove that fields were never removed or reconstructed externally.

## HTTP boundary

The local adapter binds to `127.0.0.1`, validates the Host header, rejects cross-origin requests, serves only supported local file types and exposes no write-file endpoint. It is intentionally not deployed as a public backend. The GUI can use `?api=local` for HTTP or omit it for the same in-process API.

## Rules revision and historical records

New sessions carry `rulesRevision`, equal to the engine's exported `RULES_REVISION`. `project`, `execute`, `importSession` and `exportSession` reject missing or different revisions before any action is evaluated. Save format 1 alone is not a rules-compatibility guarantee. Clients must preserve rejected files and must not inject the current revision, strip audit fields or drop failing actions.

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

`character.benefitCredits` retains each source-earned credit's identity, origin, value, scope, status and consumption. Prole Event 3 is global; Event 4 is restricted to the originating career's ordinary benefits. `benefitCreditOptions` gives the eligible options at ordinary benefits and advisory cash. Send `creditIds` on `benefit` or `advisory-cash` to apply only the selected credits. Omission or an empty array preserves them. Duplicate and ineligible IDs reject without mutation. Cash-source resolution, restore and replay retain exactly one consumption for the effective roll.


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
- At `aslan-officer-rank`, `resolve-aslan-officer-rank {tableId,reason}` requires GM mode and an explicit choice from projected printed headers. The successful qualification remains unchanged. The saved mapping applies to that career's future rank awards. No Navigator/Shipmaster mapping is assumed from the mismatched source headings.
- An `aslan-officer-status` source step verifies a prior Outcast/Outlaw history when necessary. `resolve-book` requires GM mode, `confirmed: true`, `aslanOfficerStatusApproved`, a source-basis `note`, and `aslanOfficerStatusConfirmed: true` for approval. Approval applies only to this offer. Denial does not leave the old career, roll qualification or consume benefits.

`character.aslanOfficerOffers` retains the grant boundary, source/origin career, selected assignment, completed-term DM, commitment, check, cancellation, rank mapping and `statusVerification`. Forced stay is not waived; unused offers expire if another term intervenes. Ordinary forced exit does not itself disqualify the offer.

`character.aslanStatusChanges` records source, timing, SOC/status before and after, removed Clan Share tokens and affected award IDs. Native Aslan qualification failure sets SOC 2/Outcast and forfeits held unconverted Clan Shares, including those just received during mustering out. Original award records remain annotated rather than erased. Other benefits and cash history are preserved. No repossession of previously redeemed cash, ships or land is inferred.

Native Aslan cash limits and male half-cash handling remain distinct from the Core three-roll rule. Broad Hierate/Core access, owned land/redemption and generic same-career Aslan assignment mapping remain outside this bounded route. Native origin setup is documented separately below.

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

Family origin procedures are documented below. Owned land/redemption and general Hierate/Core access remain separate work; these bounded restoration paths do not certify complete Aslan generation.

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
- `female-independence`: `{decision:"omit"|"grant-level-zero",reason}`. The level-zero grant is explicitly a referee exception to the gender restriction, not an invented substitute award.
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

The always-on audit includes these ledgers and stable relationship identities. Replay/import uses the current rules revision; `.10` files are not automatically migrated. Male equipment, corporate equity, land acquisition/claiming and cross-character pooling are not implemented by these commands.
