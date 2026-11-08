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
- Life path: `background`, `precareer`, `skip-precareer`, `career`, `fallback`, `training`, `survival`, `advancement`, `commission`, `continue-career`, `leave-career`, `benefit`, `ageing`, `finish`.
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
