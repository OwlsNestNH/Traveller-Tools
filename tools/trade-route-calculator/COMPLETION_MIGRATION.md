# Save-completion migration queue

Inventory checked against UI 2026.10.10.47, repository merge
`8ab805fa0dc2bf3fa52a4ca9e33f1ef49212050d` (2026-10-10).
This records the save-boundary work, not the earlier GUI-refit stages.

## Stage 2: finish save callers

The controller is centralized and supports synchronous saves or an explicit
completion Promise. Its transition, prepared-jump, Undo, Undo Jump and campaign
replacement paths retain revision/ownership checks. That centralization does
**not** mean every UI caller waits safely for completion. The live local Store
is still synchronous; this queue is preparation for a delayed provider, not a
claim that ordinary local saving is currently broken.

A completed caller must wait before showing success or changing its draft,
block repeat submission while pending, preserve ownership/revision checks, and
distinguish a known uncommitted failure (safe correction/retry) from a committed
publication failure or unknown result (reload required, no duplicate retry).

### Verified patterns already present

- Deposit confirmation: awaited modal with terminal/reload protection.
- Refuel, fuel correction and life-support refill: owned service session,
  pending-save controls, completion-aware cleanup and terminal/reload protection.
- Individual World Changes correction: the awaited confirmation pattern,
  including its own failure context.

### Remaining queue, in priority order

1. **Jump preparation and commit: released and verified in .42.**
   `app.mjs: jump` waits for preparation and commit completion, retains the same
   prepared dice across a known-unsaved retry, and freezes elapsed hours while
   saving. Native and exact-head browser tests, independent screenshot review
   and live-file verification passed, including the saved-roll/mulligan policy.
2. **Undo and campaign replacement: released in .43/.44.**
   Ordinary Undo/Undo Jump and JSON import/reset passed their full native,
   exact-head browser and independent source/screenshot gates. Replacement .44
   passed 1,117 native tests, 53 CI jobs and 98 focused browser cases; 36 actual
   screenshots were independently reviewed. Its exact merge/tree and Pages
   deployment were verified. All 90 permitted live-file URLs matched; ten
   prior tunnel/proxy-denied URLs were skipped, so full live verification is
   explicitly incomplete. No denied path was retried or alternate-routed.
3. **Settings: released in .45.** Inline and legacy Settings have an owned
   completion boundary, retained form/rounding, deliberate known-unsaved retry
   and saved/unknown reload protection. Final 1,155 native tests, 54 exact-head
   CI jobs, 46 focused browser cases and independent source/38-screenshot review
   passed; merge/tree and Pages were verified. All 90 permitted live URLs
   matched; ten prior proxy-denied variants remain unverified and excluded.
4. **Setup/location: released in .46; time/day are the .48 candidate.**
   Cancellable lookup now precedes its owned pending-save boundary. Setup's
   nearby enrichment remains ancillary after its saved opening balance;
   location lookup stays pre-save. Final 1,293 native tests, 55 exact-head CI
   jobs, 160 focused browser cases and independent 36-screenshot review passed.
   Merge/tree, Pages and all 90 permitted live URLs were verified; ten prior
   proxy-excluded variants remain unverified. Duplicate CI also passed.
   The .48 candidate gives `changeCampaignDay` and `timeForm` an owned save
   boundary, pre-yield repeated-click protection and terminal reload handling.
   Time/LSS/economic mutation semantics remain exact. Local/source verification
   does not complete this item: exact-head browser and screenshot gates must
   pass before release, followed by merge/Pages/permitted live-file checks.
5. **Trade and transport workflows with post-save UI effects.**
   `searchDialog`, `saleForm`, `editDraft`, `contractSearch` and `accept` publish,
   replace or clear previews/drafts after invoking a save. `passenger-ui.mjs`
   capacity setup, passenger search and boarding also discard completion;
   passenger search publishes generated offers immediately.
6. **Remaining direct mutation/confirmation callers.** Audit and migrate
   `editOffer`, `manualContract`, `amendPolicy`, the market expiration checkbox,
   and `rollBerthingRate` (which reads `next.revision` synchronously).
   Confirmations that already return the save still need the full pending and
   failure contract: `roundingPreview`, `overrideWorld`, `saveMapRoute`,
   `plotRoute`, `clearPlannedRoute`, `buyForm`, `insureHeldCargo`, `reject`,
   `existingLot`, `correctCargo`, `claimForm`, `cancelMail`, `deliver`,
   `shipExpenses`, `expenseForm` (manual expense/bank correction), passenger
   delivery, and the expire-all action. Returning a Promise alone is not full
   completion safety; several listed callbacks also discard it.
7. **Expense screen failure handling.** `expense-panels.mjs: savePayment` and
   `saveRate` already await saves and block repeat submission, but their generic
   catch/finally path needs the same explicit committed/unknown terminal safety
   review as deposit and stock services. Do not count them as fully migrated
   merely because they contain `await`.

8. **Owned background-map presentation: released in .47.**
   A test-only audit on exact .46 runtime reproduced candidate map data entering
   the DOM during held Undo Jump/import settlement at both desktop/mobile
   widths. All 14 diagnostic probes were valid and 34 screenshots were reviewed.
   Cache-origin paint caused the first exposure; later resize repainted already
   exposed state. Desktop marker pixels were outside the opaque dialog rectangle, dimmed
   and blurred by its backdrop; mobile findings were DOM-only because markers
   were below the viewport.
   The .47 release adds only the existing Undo/replacement ownership guards
   to `paintMap()` and strict regression assertions for those four cases.
   Settings showed a rebuild without changed campaign semantics and is unchanged.
   Normal History/inline Settings/reset controls had no mounted map. The native
   Store remains synchronous; this is a delayed-provider contract correction.
   All 1,345 native tests, 56 exact-head CI jobs and the 14-case focused browser
   suite passed; all 34 screenshots were independently reviewed. Four strict
   regression cases retained the prewrite DOM through actual callbacks. Exact
   merge/tree and Pages, all 90 permitted live URLs and duplicate CI were
   verified; the ten prior proxy-denied variants remain excluded/unverified.
   The earlier .46 prewrite empty-style mismatch, Cargo detached-handle pointer
   input race and keyboard-focus restoration issue remain separate findings.

Each batch needs delayed success, known pre-write failure, committed-publication
failure, unknown outcome, duplicate activation, stale revision/ownership and
cleanup/reload tests, plus the existing synchronous and real-browser regression
gates. Keep ledger/history/Undo/economic behavior unchanged. Stage 2 remains
open until this inventory is reconciled and every caller is covered; later
feature work must add any new write callers here.

## Stage 3: quote and preview ownership

After Stage 2, separately consolidate who owns a quote/preview and when it
becomes stale or is discarded. Current session data includes `saleQuotes`,
`saleTaxDice`, `previewSale`, `editSale`, selected cargo, freight/mail drafts and
passenger drafts. Review/world/buyer/campaign changes, replacement, cancellation,
reopening and editor handoff must retain the intended price/dice reuse without
allowing an old response or detached control to act on a newer session.

This is a lifecycle/ownership task, not another accounting engine and not a
substitute for finishing save completion. Stage 3 has not started in this batch.
