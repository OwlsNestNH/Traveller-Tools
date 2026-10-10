# Save-completion migration queue

Inventory checked against UI 2026.10.10.42, merge
`1780038d016c0c825b134319d4d63cb7021be075` (2026-10-10).
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
2. **Undo and campaign replacement.** `undoJump` and `undoLatestChange` are
   the current bounded .43 completion-safety candidate. Ordinary Undo retains
   its immediate click behavior with a pending screen only for delayed saves;
   Undo Jump retains its existing confirmation. Their exact-head browser and
   screenshot gates remain required before release. `backupReplace` still
   needs a separate batch for JSON import and reset; it currently cleans up
   and announces replacement before the controller completion is known.
3. **Settings, setup and position/time changes.** The inline
   `mountSettingsForm` submit clears its draft without waiting; `setup`,
   `setLocation`, `changeCampaignDay` and `timeForm` discard the save completion.
   The Settings modal returns it but lacks terminal/reload handling.
4. **Trade and transport workflows with post-save UI effects.**
   `searchDialog`, `saleForm`, `editDraft`, `contractSearch` and `accept` publish,
   replace or clear previews/drafts after invoking a save. `passenger-ui.mjs`
   capacity setup, passenger search and boarding also discard completion;
   passenger search publishes generated offers immediately.
5. **Remaining direct mutation/confirmation callers.** Audit and migrate
   `editOffer`, `manualContract`, `amendPolicy`, the market expiration checkbox,
   and `rollBerthingRate` (which reads `next.revision` synchronously).
   Confirmations that already return the save still need the full pending and
   failure contract: `roundingPreview`, `overrideWorld`, `saveMapRoute`,
   `plotRoute`, `clearPlannedRoute`, `buyForm`, `insureHeldCargo`, `reject`,
   `existingLot`, `correctCargo`, `claimForm`, `cancelMail`, `deliver`,
   `shipExpenses`, `expenseForm` (manual expense/bank correction), passenger
   delivery, and the expire-all action. Returning a Promise alone is not full
   completion safety; several listed callbacks also discard it.
6. **Expense screen failure handling.** `expense-panels.mjs: savePayment` and
   `saveRate` already await saves and block repeat submission, but their generic
   catch/finally path needs the same explicit committed/unknown terminal safety
   review as deposit and stock services. Do not count them as fully migrated
   merely because they contain `await`.

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
