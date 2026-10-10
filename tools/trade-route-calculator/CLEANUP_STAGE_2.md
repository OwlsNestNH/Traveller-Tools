# Stage 2 — campaign write boundary

First checkpoint: synchronous relocation, based on main commit
`376281def131a3b1e7713b7e4c3831561f6dc671` (UI 2026.10.10.33).
Stage 1 is already merged. This checkpoint remains independently revertible.

## Scope

`js/campaign-controller.mjs` now orchestrates ordinary transitions, prepared
jump rolls, History Undo, jump mulligans and confirmed import/reset. Callers
pass their expected revision explicitly. The application retains service guards,
modal/session lifecycle, success messages, rendering and feature-specific cleanup.
The temporary `saveCampaign` adapter retains the existing test-slicing boundary.

The real Store still checks editing authority and the latest disk revision,
validates serialized campaign data, writes synchronously and publishes its
validated snapshot through `onChange`. State still owns calculations, validation,
accounting, inverse Undo and the jump-attempt rules. Ordinary actions still merge
cached worlds and attach rounding audits. Replacement notifications still clear
local offers even when an import reuses their IDs.

No schema, key, rounding, price, history, locking, timing or data migration change
is included. The application shell still selects the ordinary action's expected
revision from its existing modal context; the extracted controller never reads
DOM or infers a revision itself. This is not an asynchronous or cross-device store.

## Characterization and verification

The initial characterization commit ran the released app's ordinary-write
functions with the real Store. The same assertions now import the controller.
Tests cover money, stock-service and contract write failure/retry; synchronous
publication; memory/disk revision rejection; editing loss; rounding and cached
worlds; prepared dice/reload/mulligan; replacement/recovery; and notification
failure after a durable write.

`verification/fixtures/campaign-writes-baseline.json` records 13 exact JSON byte
checkpoints generated against the released app with deterministic IDs and dice.
The extracted controller must reproduce them without normalizing revision,
event, ledger, inverse Undo or jump-attempt differences. This fixture is synthetic
and contains no user campaign. Direct tests also prove ordinary Undo restores
money, stock and contracts after a retry.

Before extraction: 642 native tests passed. After extraction: 655 tests in all 54 discovered
native suites passed, including 13 controller cases. The 227 rules/data checks,
syntax checks, module graph and shared tool integration also passed.
The original draft head `512f2bf7453176531a9bbf28959b0a1a979bc0a4` passed the
[full Chromium matrix](https://github.com/OwlsNestNH/Traveller-Tools/actions/runs/38047684116)
and [five campaign routes plus 21 adversarial compound scenarios](https://github.com/OwlsNestNH/Traveller-Tools/actions/runs/38047684117).
Independent source review found no blocking extraction defect; actual-pixel
review covered 28 adversarial and jump screenshots at desktop and narrow widths.
An independent replay of literal released-app write blocks also passed all 13
characterization cases, including every exact saved-JSON checkpoint.

Release preparation advances the runtime cache token and UI/report version to
2026.10.10.34 without changing behavior. The resulting final head must pass the
same complete workflows and screenshot review before merge. Browser execution
uses GitHub Actions; this workspace does not claim a local Chromium pass.
The user approved uploading the checkpoint as a draft PR and subsequently
authorized tested and reviewed publication. CI success alone is not a live
deployment claim.

## Follow-up checkpoint

The Promise completion contract and all mutating callers remain a separate
change. Before it, define explicit committed versus failed outcomes and review
post-write notification failure. Current characterization demonstrates that
`onChange` can throw after disk has advanced: memory may still show the old
snapshot, and retrying the old revision is rejected. This checkpoint preserves
that behavior and does not classify that exception as a failed durable write.

Further stage-2 acceptance work includes the compound passenger/resource
journey, expanded ownership-contention cases and delayed completion adapters.
Those are not represented as completed by this extraction. Trade-preview
ownership and shared-device implementation remain separate work.

## Revision guard checkpoint — UI 2026.10.10.36

Based on released merge `1660f7b52cd03409298a95551765c30b440a2b05` (UI .35).
Prepared-roll writes and History Undo now reject an expected revision that
does not match the in-memory campaign used to construct their next state.
This closes a controller-boundary gap: supplying a newer disk revision while
memory was still old could otherwise overwrite the newer saved campaign.
Normal UI callers did not supply that combination, but the controller must
fail closed independently. Rejection preserves the full saved bytes and
published state, including balances, stock, contracts and history.

The guard applies only when preparation would write. Reopening an existing
prepared roll remains a non-writing read, including stale expectations and
read-only ownership; its later commit still revalidates through the normal
write path. State still creates the preparation candidate before the guard,
so rejected fresh preparation can call the supplied dice function without
retaining its result. History Undo checks the memory revision before deriving
the inverse change. Store still owns editing authority and disk-revision
checks, and all saves remain synchronous.

Focused native regressions use the real Store with synthetic storage and
compare complete memory and saved JSON bytes on rejection. All 23 controller
cases pass; running the same suite against the unchanged .35 controller
produces seven expected failures. All 667 native tests across 54 suites,
227 rules/data checks and shared tool integration pass locally. The dedicated
`campaign-revision-browser` suite exercises real Chromium localStorage and
the rendered failure/retry flow in an isolated synthetic campaign. It joins
the read-only exact-head Actions matrix; browser success and actual screenshot
review remain release gates, not claims made by adding the test. Existing
13 saved-JSON equivalence checkpoints remain unchanged. The runtime cache
token, visible version and generated report version advance together to .36.

This checkpoint does not introduce Promise-backed saves, reclassify exceptions
after a durable write, change campaign schema or arithmetic, or implement
shared-device storage. Those later decisions remain separate.
