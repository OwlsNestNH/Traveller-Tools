# Save-completion migration queue

Inventory refreshed against UI 2026.10.11.60, repository merge
`dc9006ad649aff7973be1d24276b7a64946ae982` (2026-10-11).
This records the save-boundary work, not the earlier GUI-refit stages.

## Stage 2: finish save callers

The controller supports synchronous saves or an explicit completion Promise.
Its transition, prepared-jump, Undo, Undo Jump and replacement paths preserve
revision and editing checks. The live local Store remains synchronous. This
queue concerns delayed-provider completion safety; centralizing writes alone
never established that every UI caller waits safely for completion.

A completed caller owns its review, campaign/revision and editing tenure; blocks
repeat submission; waits before success or draft cleanup; and distinguishes a
known uncommitted failure from a saved or unknown outcome. The latter requires
reload protection so an uncertain transaction cannot be repeated.

The generic modal already awaits a Promise returned by its callback and sets
`session.busy`. That alone is insufficient: without an explicit completion
contract, dismissal/replacement and ordinary error handling remain possible.
Callbacks which discard the Promise bypass even that wait. Do not blanket-enable
`awaitSave`: pre-provider validation must remain known-uncommitted, and each
operation needs its own identity, failure context and owned cleanup.

### Released patterns

- Deposit confirmation; Refuel, fuel correction and life-support refill; and
  individual World Changes reversion already have completion-aware boundaries.
- **.42 Jump preparation/commit:** preserved roll reuse, revision checks and the
  one-mulligan policy through delayed preparation and commit.
- **.43/.44 Undo and replacement:** ordinary Undo/Undo Jump and JSON import/reset
  have owned completion and terminal/reload handling. Replacement invalidation,
  audit behavior and schema compatibility remain intact.
- **.45 Settings:** inline and legacy forms preserve inputs, rounding and
  disclosures through pending completion and deliberate known-unsaved retry.
- **.46 Setup/location:** cancellable world lookup precedes the owned save;
  opening balance and Dashboard baseline remain normal state mutations. Setup
  nearby enrichment is ancillary, while location lookup remains pre-save.
- **.47 Owned map publication:** Undo/replacement map callbacks retain the
  prewrite presentation until settlement. Four reproduced cases became strict
  regressions; normal foreign publication and editor invalidation still win.
- **.48 Time/day:** daily controls and Campaign time now have an owned boundary,
  pre-yield repeated-click protection, retained date/LSS presentation and saved/
  unknown reload handling. Time/LSS mutation bodies, Undo and permanent jump
  mulligan closure are unchanged. Final 1,480 native tests, 227 rules checks,
  57 exact-head CI jobs and 142 focused browser cases passed. Independent review
  inspected 52 of 192 actual screenshots and audited all case records. The first
  candidate's existing Mail failure exposed a stale error on successful close;
  the correction retained the Mail assertion and strengthened fresh/retry/
  validation success and terminal-cleanup checks. Original evidence is retained.

- **.49 Sale commit:** the accepted review and selected cargo remain owned until
  completion. Exact prices, tax dice, fees, rounding and existing cache eligibility
  are preserved. Final 1,575 native tests, 227 rules checks, 58 exact-head CI jobs
  and 40 focused browser cases passed. The initial 46 overview screenshots left
  mobile warnings/footer and saved-summary details outside the viewport; eight
  test-only detail captures closed that framing gap with all original assertions
  retained. Independent review inspected all 46 initial images and 18 final
  images, including all eight added details, and audited all 54 final layouts.

- **.50 Dedicated Expense panels:** mortgage, maintenance, salary, berthing and
  saved-rate operations own publication/completion and retained retry intent.
  The native provider remains immediate; stale durable baselines retire the old
  draft with accurate not-saved reload guidance. Rate-to-payment reentrancy,
  receipt/navigation and background map ownership are covered without changing
  monetary/schedule/state/Store/controller bodies. Final 1,705 native tests,
  227 rules checks, 59 exact-head CI jobs and 65 focused browser cases passed.
  Review audited all 186 frames/85 detail-layout records, scanned all images and
  individually inspected 40 originals (15 desktop, 25 mobile). Disk-only stale
  detail is desktop-only; mobile stale/retry are separate cases.

- **.51 Shared-modal initial entry:** only non-sale initial control synchronization
  moved inside the existing pre-callback try; Sale's established entry catch
  stayed outside. Final 1,843 native tests, 227 rules checks, 60 exact-head CI jobs
  and 50 focused browser cases passed. Review audited all 194 frames and
  individually inspected 44 originals. An initial Settings test-boundary failure
  was corrected by settling and proving the native blur/preview reads before the
  fault baseline; all strict post-entry assertions remained unchanged. Persistent
  cleanup faults retain their separately documented existing limitations.

The .51 exact merge/tree, Pages deployment and all 90 permitted live URLs were
verified. Duplicate CI passed after one unchanged-head Setup/location job rerun:
its initial 159/160 result timed out at a final network-idle wait after the case's
save/terminal/reload/Undo assertions. The rerun passed 160/160. Original evidence
is retained; missing request-level traces leave the exact idle cause unproven. Ten URL variants at prior tunnel/proxy-denied
paths remain excluded and unverified; no denied path was retried or alternate-
routed. This is not a claim of complete 100-URL live-file verification.

- **.52 Purchase confirmation:** one atomic purchase, including optional
  at-purchase insurance, owns accepted terms and the pending save. Final 2,001
  native tests, 227 rules checks, 61 exact-head CI jobs and 59 focused browser
  cases passed. Independent review audited 109 frames and opened 41 originals,
  including all 28 mobile images. The initial 56/59 browser result is retained:
  two test-observer ordering failures and one mobile loading-baseline failure
  were corrected only in the harness, preserving every strict assertion. The
  corrected report directly observes initial cache completion before baseline,
  then owned publication and the held cache callback with zero DOM mutations.
  Runtime was unchanged between browser runs. Exact merge/tree, Pages and all
  90 permitted live URLs matched; duplicate CI passed all 61 jobs. The existing
  ten proxy-denied URL variants remain excluded and unverified.

- **.53 Held insurance, claims and amendments:** the remaining direct insurance
  callers own accepted lot/policy/route/form terms through completion. Final
  2,481 native tests (480 focused), 227 rules checks, 62 exact-head CI jobs and
  94 focused browser cases passed. All 187 producer image hashes/layouts were
  audited, all images scanned, and 71 originals inspected including every one
  of the 45 mobile frames. Twenty complete original/candidate economic results
  match after generated-ID normalization; the amendment body is byte-identical.
  Exact merge/tree, Pages and 90 permitted URL variants matched; all 62 duplicate
  CI jobs passed. Ten prior proxy-denied variants remain excluded. The direct
  insurance caller inventory is complete, closing the purchase/insurance group.

- **.54 Supplier/buyer contact search:** the sole search write caller now owns
  its accepted generated snapshot, dice, review and completion. Final 2,815
  native tests (334 focused), 227 rules checks, 63 exact-head CI jobs and 98
  focused browser cases passed. All 196 image hashes/layout records and frames
  were reviewed; 84 originals were individually inspected, including all 48
  mobile images. Twenty-six independent ownership probes and 96 full original/
  candidate state/period/LSS/Undo comparisons passed. The first browser run's
  38 failures checked an Overview-only clock while correctly on Trade; a test-
  only navigation correction retained all assertions, 98 cases and 196 frames.
  Runtime was unchanged. The earlier 89-case plan expanded before publication
  for construction-fault coverage. Exact merge/tree, Pages and all 90 permitted
  live URLs matched, and all 63 duplicate jobs passed. Ten restricted variants
  remain unverified. Mobile Sale handoff review covers title/cargo, not every
  Sale scroll region; the separate Sale recovery assessment remains unproven.

- **.55 Freight/mail generation and draft editing:** both production callers now
  use one owned generation/edit completion boundary. Final 3,267 native tests
  across 75 test files (438 focused), 227 rules checks, 64 exact-head CI jobs and
  102 focused browser cases passed on the first candidate browser run. All 225
  image hashes/layouts and frames were reviewed; 105 originals were individually
  inspected, including all 68 mobile frames. Forty-two independent ownership
  probes and 36 full original/candidate state/ephemeral/dice comparisons passed.
  Exact merge/tree, Pages and all 90 permitted live URL variants matched; all 64
  duplicate jobs passed. Ten restricted variants remain unverified. Extreme
  synthetic payment values overlap numeric table cells in candidate pixels;
  unchanged renderer/formatting/CSS supports pre-existing behavior without a
  separately observed baseline browser result. Mobile terms/actions were
  captured separately, not all middle columns simultaneously. This closes the
  generation/draft group; acceptance, cancellation and payout remain separate.

- **.56 Freight/mail acceptance, cancellation and delivery:** all four callers
  completed. Final 4,189 native tests across 76 files (922 focused), 227 rules
  checks, 65 exact-head CI jobs and 98 focused browser cases passed. All 276
  image hashes/layouts and frames were reviewed; 127 originals were individually
  inspected, including all 84 mobile. Fifty-one independent ownership probes
  and 104 full UUID-normalized original/candidate state/ephemeral/dice outcomes
  passed. Five strict map cases observed 70 real callback edges with no pending
  DOM mutations. Original 889/898 and 4,181/4,189 fixture failures and corrections
  remain documented, as does a failed pre-process local browser executable lookup;
  actual browser evidence is GitHub CI. Exact merge/tree, Pages, all 90 permitted
  live URL variants and all 65 ready-event duplicate CI jobs were verified. Ten
  restricted variants remain unverified. Existing extreme-number table overlap,
  separately scrolled mobile columns and representative browser economics remain
  qualified. Exactly two acceptContract callers, one cancelMail and one deliver
  caller were inventoried, closing the freight/mail lifecycle group.

- **.57 Passenger capacity setup and search:** both callers own accepted review,
  generated four-class results/dice/audits and completion. Final 4,629 native tests
  across 77 files (440 focused), 227 rules checks, 66 exact-head CI jobs and 110
  focused browser cases passed. All 310 image hashes/layouts and frames were
  reviewed; 142 originals were individually opened (all 86 mobile, 56 desktop;
  90 distinct image hashes). Forty-four complete original/candidate outcomes
  matched after UUID-only normalization. The initial 97/110 browser result is
  retained: a test-only correction fixed full mobile target-range framing and
  quality-30 image budgeting without changing runtime or the byte ceilings.
  Initial extreme unbroken Jump-name overflow remains observed candidate behavior
  with inherited-source attribution, not separately observed baseline pixels.
  One unchanged Cargo keyboard-selection failure showed map-only SVG replacement;
  an independently reviewed unchanged-head rerun passed, with exact keydown target
  and callback cause still inferred. That race is not fixed by this release.
  Exact merge/tree, Pages, all 90 permitted live URL variants and all 66 ready-
  event duplicate jobs were verified. Ten restricted variants remain unverified.
  Mobile booking tables remain horizontally scrollable and browser economic
  screenshots are representative. Boarding/delivery remain the next subbatch.

- **.58 Passenger boarding/delivery:** both remaining saved callers and the
  side-effect-free first boarding form/preview/handoff have owned completion.
  Final 5,306 native tests across 78 files (676 new focused cases), 227 rules
  checks, 67 exact-head CI jobs and 139 focused browser cases passed. All 260
  frame hashes/layouts were checked and scanned; 99 originals were individually
  reviewed (64 mobile, 35 desktop, 81 distinct hashes). The final diagnostic-only
  head preserved those 260 image bytes exactly. Twenty-two complete original/
  candidate outcomes and separate real-jump/Undo comparisons preserved economics.
  Initial 131/139 browser evidence is retained: helper-local scroll bookkeeping,
  exact saved-warning expectations and one dedicated first-boarding paragraph
  wrapping rule corrected the evidenced failures without relaxing assertions.
  Two unchanged Setup suites initially passed 159/160 with final 15-second idle
  timeouts after save/reload/Undo; bounded passive request diagnostics then
  observed two clean 160/160 runs. Their earlier causes remain unknown and
  observer timing effects remain possible. One Cargo failure and its single
  authorized unchanged-head rerun remain recorded; the separate inferred SVG/
  keyboard-focus race is not fixed. All 67 ready-event duplicate jobs passed
  before merge. Exact merge/tree, Pages and all 90 permitted live variants were
  verified; ten established restricted variants remain unverified. Horizontal
  mobile booking-table scrolling and extreme ledger-row text overlap remain
  qualified, with inherited layout attribution based on source rather than
  separate baseline pixels. All four passenger callers are now complete.

- **.59 Legacy Accounts:** all four saved branches completed: atomic expense
  bundle, retained inline berthing rate, manual expense and bank correction.
  Final 5,862 native tests across 80 files, 227 rules checks, all 68 exact-head
  and ready-event duplicate jobs, and 222 focused browser cases passed.
  All 255 frame hashes/layouts, 528 target extents and 14 full vertical walks
  were checked. Independent original-resolution review covers 106 distinct
  final images, including all 67 mobile images, with exact-byte reuse recorded.
  All 80 complete original economic outcomes and native event-loop timing remain
  unchanged. Actual browser testing caught production-form chrome ownership,
  warning-precedence and dismissal-recovery defects; strict corrections and
  separate test-boundary corrections retain the earlier failed evidence.
  Exact merge/tree, Pages and all 90 permitted live variants were verified;
  ten restricted variants remain unverified. Mobile offscreen horizontal columns,
  extreme ledger overlap and prior Setup/Cargo findings remain qualified.
  The optional fuel-only bundle path remains compatibility coverage without a
  production caller. This closes Accounts, not unrelated automatic policy writes.

- **.60 Clear Planned Route:** final 6,027 native tests across 83 files, 227
  rules checks, all 69 exact-head CI jobs and 87 focused browser cases passed.
  All 82 original cases remain, with five additional dismissal/preclaim controls.
  Independent review inspected 52 unique actual images; 45 other frames matched
  those exact bytes. All 97 frame hashes/layouts, including 46 mobile frames,
  were reconciled. Original 66/82 browser failures and native diagnostic failures
  are retained: one Clear-only wrapping class, owner-checked independent dismissal
  restoration and three corrected test-model boundaries resolved them. Exact
  merge/tree, Pages, all 90 permitted live variants and all 69 ready-event duplicate
  jobs were verified. Ten established proxy-restricted variants, including both
  style.css URLs, remain unverified. Source/CI and actual candidate CSS pixels
  passed; restricted live stylesheet bytes are not claimed verified.

### Remaining bounded groups

These are scope groups, not a promise that each needs exactly one release.
Further inventory findings must be recorded rather than declaring Stage 2 done.
There are two open groups after the verified Clear Planned Route release. Automatic policy
updates remain part of their owning workflows; no new accounting engine is needed.

1. **Route/world/rounding confirmations.** Clear Planned Route is released.
   The .61 candidate targets saveMapRoute and plotRoute final-save completion:
   retain accepted path/stops/world terms and the exact owned draft until a
   verified save; distinguish known-unwritten retry from saved/unknown outcomes.
   Preserve the travelled prefix, routeIndex, ordered repeated mandatory stops,
   routing/tie-breakers, advisory fuel, exact economics and Undo/mulligan. Map save
   still merges the live known-world catalog; Plot still saves its calculated
   world snapshot. Initial Plot lookups stay cancellable and sequential, with
   original attached picker/control identities and values checked at continuation
   boundaries. Partial form construction retires only its exact owner.
   The group remains open. Subsequent bounded work is ordinary overrideWorld,
   then roundingPreview Apply. World override is distinct from completed World
   Changes reversion. Stage 3 quote/cache work has not started.
2. **Cargo adjustments and market controls.** app.mjs: existingLot,
   correctCargo, reject, editOffer, market-expiration checkbox and expire-all.
   Returning confirmations still need ownership/terminal handling; overrides/
   checkbox discard completion. Expire-all is a direct action without an owned
   pending surface. Restore checkbox presentation on known-unsaved failure
   without pretending an uncertain save did not happen.


Each batch needs synchronous equivalence, delayed write/publication/settlement,
known-unsaved retry, committed/unknown outcomes, duplicates and queued actions,
stale campaign/editor/modal ownership, cleanup/reporting faults, reload and Undo.
Preserve ledger, History, exact economics and existing dice policies. Existing
browser regressions remain mandatory alongside focused desktop/mobile cases.

## Stage 3: quote and preview ownership

Only after Stage 2, separately consolidate who owns a quote/preview and when it
becomes stale or is discarded. Current session data includes `saleQuotes`,
`saleTaxDice`, `previewSale`, `editSale`, selected cargo, freight/mail drafts and
passenger drafts. Review/world/buyer/campaign changes, replacement, cancellation,
reopening and editor handoff must retain intended price/dice reuse without letting
an old response or detached control act on a newer session.

The sale-only completion batch must preserve today's behavior: same eligible
world/revision/buyer reuses quotes; editing quantities/fees retains FormData and
price rolls; tax caches remain buyer/revision keyed; successful sale clears
selection without explicitly clearing all quote/tax/preview caches. It must not
invent stronger cache promises or persistent quotes. Stage 3 is a lifecycle task,
not another accounting engine or a substitute for unfinished save callers.
