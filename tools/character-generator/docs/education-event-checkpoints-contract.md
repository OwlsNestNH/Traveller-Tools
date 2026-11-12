# Isolated revision .31 education checkpoint contract

Candidate engine work only. No GUI, release or publication is included. Integration requires independent review, current-version test-helper updates, full tests and actual desktop/mobile UI checks.

## Coverage

The new context applies only to revision `.31` Core University after an automated successful entry, with graduation still permitted at the initial event. Covered event rows: **all Core University rows 2–12**. Academies, Companion, source-assisted entry and historical revisions retain their existing behavior.

**Outside this automation scope:** academies, Companion and source-assisted University admission retain their existing paths. Required source decisions within a covered event remain source-assisted; a checkpoint never invents a missing score, funding decision or species ruling. Ordinary events are not excluded solely for permanent PSI loss. Existing PSI-specific restrictions are unchanged.

Row 4/11 departure already uses the existing source-assisted education-ageing step, not an automatic ageing die. The new result holds that pending source unchanged until acknowledgment. Event-forced departure remains `graduation.attempted:false`, not a failed graduation roll.

## Commands and stages

- `education-event` remains the initial explicit 2D command.
- `education-event-roll`: `roll-education-event-step` accepts **only** `{pendingId}` from `state.pendingEducationEventRoll.id`. It verifies active education, exact queue head including source, and the projected check context. It permits exactly one dice operation, then pauses at another roll or an existing choice/result.
- `education-event-result`: `acknowledge-education-event` accepts **only** `{pendingId}` from `state.educationEventResult.id`. It verifies the record/continuation/source-pending state, removes the result, and restores its already-resolved destination. It never calls the effect drainer, rolls dice or applies awards.
- Row 3 completes the term without a graduation attempt and pauses before the existing career/source-ageing destination. Its acknowledgment adds no dice or effects.
- Row 9 keeps ordinary hobby selection dice-free. Male Aslan Independence selection queues a separate `education-hobby-independence` 2D checkpoint, source Aliens 2026 p.20. Its rule is raw2D strictly greater than current SOC, not a SOC characteristic DM. Pending comparison fields are `comparison:greater-than`, `comparisonStat:SOC`, `comparisonScore`, `modifier:0`, and integer success `target:SOC+1`. Female Aslan and non-Aslan eligibility is unchanged.
- Row 2 keeps existing `choose-effect` Test/Decline. Test draws PSI2D only if PSI is absent; recorded PSI including 0 is reused.
- Row 7 uses the same explicit roll command for Life Event2D, Unusual Event1D, Injury1D and severity1D. Existing loss/treatment, typed Life decisions, source organisation coverage and Science-specialty/cap choices remain native. Institute Test explicitly rolls potential2D only when absent; no training/talents are granted. Death clears the event context and acknowledges to the existing deceased destination, never graduation.
- Row 10 keeps existing `education-check` with `{name}`. That explicit button rolls the selected skill check.
- Row 11 retains `choose-effect` Flee/Draft. In .31, choosing Draft queues an explicit **separate** 1D draft checkpoint. Choosing Draft alone does not roll.
- While at a new roll/result stage, only its matching command, `notes`, and `gm-mode` are allowed. Audited restore/replay remains available through existing project handling. Missing-characteristic source steps retain their existing native route.

Use ordinary request action IDs/expected revisions in addition to pending identity. A restored checkpoint intentionally has its original pending ID; it represents a restored action, not permission for accidental duplicate requests.

## Read-only response

`response.educationEventView` is present only while a covered event context/result is active, and is absent after acknowledgment. It is not saved presentation text.

Common fields:

- `id`, `educationIndex`, `row`, `status` (`pending` / `resolved`).
- `name`: short mechanical label, not quoted book narrative.
- `source`: Core Rulebook Update 2022, page17.
- `eventRoll`: original recorded roll object.
- `eventDice`: exact two kept faces from that record, never reconstructed from total.
- `eventTotal`: recorded table row.
- `forcedCareer`: exact current forced-career ID, or null, for next-direction text; not a newly awarded character field.
- `childRolls`: effective-branch recorded secondary roll objects with action IDs. Exact `values`/`kept`/`total` retain the dice engine audit format. Each child includes its recorded pending source: Core p.46 for Life/Unusual, p.49 for injury, and p.228 for institute potential testing.
- `childRolls[].check`, when present: pre-action recorded check context (`stat` or selected `skill`, `modifier`, `target`, modified `total`, `success`). Independence also retains its strict comparison metadata. Raw `childRolls[].total` remains the natural dice total. Do not recompute from current stats.
- `appliedChanges`: per-original/continuation-action character deltas, with action ID and command. GM edits, notes, superseded branches and result acknowledgments are not awards.
- `pendingEffects` and `pendingChoice`: still-unapplied queue/choice evidence, separate from applied changes.

Pending roll additionally exposes `roll`: identity, education index/row, kind, dice, source, label, and check stat/modifier/target when applicable. Its `effect` is the exact internal queue-head snapshot for validation, not permission for the UI to send or edit effects.

Resolved results expose `nextStage` and preserved `pending` source state. The UI must not dispatch that destination directly; use acknowledgment. Initial event roll and secondary roll evidence are distinct. Use `childRolls` for secondary dice display. The internal state result `rolls` accumulator is intentionally omitted from this public view.

## Verification baseline

Pre-change .29/.30 sessions for every event row were captured before implementation. Their exact state/log SHA256 hashes are tested unchanged. New focused tests cover strict payloads, duplicate acknowledgment, reserved .26/.28 rejection, direct rolls and thresholds, Draft continuation, source-ageing preservation, import/projection purity, PSI/skill choice continuations, restore and per-action evidence excluding GM edits. An 80-seed natural-roll matrix compares covered direct branches against .30 final character, RNG, forced career and destination.

Broad current-version scenarios explicitly acknowledge completed .31 results through a test-only helper that asserts unchanged RNG, character and pending source state. Historical fixtures are unchanged; no engine auto-acknowledgment is used. The aggregate suite passed 1,958 tests after this adaptation. Browser/UI integration remains unverified.

## Complete row 7 verification

All 11 Life rows and 6 Unusual rows are covered, including injury results1–6 and severity boundaries, zero-score death/survival, organisation-contribution source resolution, absent/0/8 PSI with cash/provided testing, no automatic training/talents, Science specialization and capped source continuation. A 120-seed natural-roll matrix compares completed nested outcomes with .30 character, modifiers, forced career, destination and RNG. Career uses of the shared tables and old revisions remain unchanged.

## Remaining-row and permanent-loss verification

Rows3/9 cover ordinary and ageing-source departure, human hobby0, native/Imperial male/female Aslan, existing Independence, raw7-versus8 at SOC7, level0 at lowered skill cap, rejected unacquired talents/Jack-of-all-Trades, and species-source admission exclusions. Permanent loss does not suppress ordinary checkpoints. Existing row2 recorded PSI0 skips testing and retains permission semantics; an absent-PSI lost state rejects retesting. Institute testing rejects permanent loss; decline retains it. Synthetic rule-state comparisons cover rare lost-potential branches without inventing a public loss-edit command.

The old Aslan hobby projector blindly mapped the string `options:any` as an array. The .31-only array guard fixes that read-only crash; older revision behavior has not been broadened pending separate review. .29/.30 all-row golden state/log fixtures remain unchanged.

Final all-row candidate verification: **1,982/1,982 Node tests passed**, including 33 checkpoint-focused groups and permanent nested rollback/strict-identity/import/replay probes. No GUI/browser or publication approval is implied.
