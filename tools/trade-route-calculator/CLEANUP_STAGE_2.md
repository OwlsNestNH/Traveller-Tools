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
On publication of a draft PR, the existing workflows will run the exact head through the full Chromium matrix,
five rendered campaign routes and the adversarial compound-flow stress suite.
Browser verification remains pending: this execution workspace has no installed
Chromium. The user approved uploading this checkpoint as a draft PR for the
exact-head workflows. No release claim follows from native checks.

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
