# Save-completion migration queue

Inventory checked against UI 2026.10.11.51, repository merge
`df9c43b79ba18ff1602885c4089a883241345b42` (2026-10-11).
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

### Remaining bounded groups

These are scope groups, not a promise that each needs exactly one release.
Further inventory findings must be recorded rather than declaring Stage 2 done.
There are eight open scope groups. The .52 candidate addresses only purchase
confirmation within group 1, including insurance bought in that same transaction.
Held-cargo coverage, claims and amendments remain in group 1 afterward; completing
one subbatch does not close that whole group.

1. **Purchase and insurance confirmations: .52 purchase-only candidate.**
   `app.mjs: buyForm` owns one atomic purchase including optional at-purchase
   insurance. The candidate adds completion handling without changing `S.buy`,
   offer prices/dice, broker fees, premium, cost basis, ledger or Undo. Candidate
   gates and release verification are still required. Separate subsequent work
   covers `insureHeldCargo`, `claimForm` and `amendPolicy`: held coverage and
   claims return `act()` without a full owned pending/terminal contract;
   amendment discards completion. Preserve their different lot/policy identities,
   premium, payout, proportional loss and amendment/refund semantics.
2. **Supplier/buyer contact search.** `app.mjs: searchDialog` discards completion
   before choosing its snapshot/tab or opening a sale. Retain its generated
   snapshot/dice on known-unsaved retry; delay UI and buyer-to-sale handoff until
   owned completion. Its elapsed time/LSS transition is separate from day controls.
3. **Freight/mail generation and draft editing.** `app.mjs: contractSearch`,
   `editDraft` discard completion while publishing/replacing local offers. Keep
   check IDs, generated dice/offers and original audits across a safe retry;
   never revive offers after authoritative foreign publication or Undo.
4. **Freight/mail acceptance, cancellation and payout.** `app.mjs:
   manualContract`, `accept`, `cancelMail`, `deliver`. Manual/generated acceptance
   discard completion; generated acceptance also removes its draft immediately.
   Cancellation/delivery return completion but still need full pending/terminal
   ownership. Preserve late-delivery dice, reservations and exact payouts.
5. **Passenger workflows, preferably two batches.** `passenger-ui.mjs: setup`,
   `search`, then `board`, `deliver`. Setup/search/boarding discard completion;
   search exposes offers and boarding renders immediately. Delivery returns
   the save but lacks full failure handling. Preserve capacity, accommodation,
   LSS/luggage and audited terms; History must not recreate actionable offers.
6. **Legacy Accounts payments and inline rate.** `app.mjs: shipExpenses`,
   `expenseForm` (including bank correction), `rollBerthingRate`. Payment forms
   remain generic; the rate path assumes a synchronous `next.revision` and
   removes its control early. Keep rate saving distinct from payment and preserve
   the remaining Accounts bundle despite completed dedicated fuel/LSS services.
7. **Route/world/rounding confirmations.** `app.mjs: saveMapRoute`, `plotRoute`,
   `clearPlannedRoute`, `overrideWorld`, `roundingPreview`. Clear-route discards
   completion and clears its draft; other returning callbacks still need the
   complete contract. Ordinary world override is distinct from completed World
   Changes reversion. Lookup/route calculations stay cancellable before saving.
8. **Cargo adjustments and market controls.** `app.mjs: existingLot`,
    `correctCargo`, `reject`, `editOffer`, market-expiration checkbox and
    expire-all. Returning confirmations still need ownership/terminal handling;
    overrides/checkbox discard completion. Expire-all is a direct action without
    an owned pending surface. Restore checkbox presentation on known-unsaved
    failure without pretending an uncertain save did not happen.


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
