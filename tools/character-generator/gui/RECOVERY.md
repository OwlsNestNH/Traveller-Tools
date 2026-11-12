# Crow recovery adapters

Recovery is presentation-independent: a page supplies typed action descriptors
(`id`, `label`, optional `ariaLabel`, `kind`, `available`, `run`). A view renders
those actions, and every action validates availability again when clicked.
Do not discover recovery by matching error text or button labels.

- A required-action Continue hides its warning and focuses the deficient control.
  It does not submit the form or change accepted state. Editing clears the ARIA
  error through the existing validation path.
- Register only existing, reversible presentation controls as `navigate` actions.
  `createNavigationDrafts` retains in-memory form values by accepted revision and
  presentation identity. Restoring a view dispatches no events or commands.
- Revisiting accepted results uses the existing GM-only `restore` command. The
  separate confirmation lists superseded active actions/rolls, branch reactivation,
  and unsaved-draft loss. Cancel keeps state and fields. Confirm does not delete
  history or rewind randomness. Never silently enable GM mode.
- Technical recovery offers backups of accepted in-memory state, reversible
  navigation where applicable, and redraw only after an action was accepted.
  It never retries commands, purchases or dice. A redraw uses the existing
  projection without sending a command. Unsaved fields are not in the accepted
  character backup; they stay on the current page.
- Startup Try again performs a user-requested full-page reload. This gives failed
  transitive modules a fresh module realm and removes all old event handlers.
  It is available only while initialization failed, before a new accepted action
  or edits on the failed page. Repeated clicks are locked. Offline/online events
  update diagnosis/availability and never trigger a retry. Browser online status
  is a hint, not evidence that an origin is reachable.

The dependency-independent technical shell must not import the app or engine.
Keep diagnostics to error/context metadata; never include character contents,
private saves, notes or seeds. Normal incomplete-action guidance keeps the
approved humorous banks; actual technical errors use factual, respectful copy.
New refurbished pages can register adapters and use these renderers without
changing the character engine or adopting the current page layout.

Essential warnings, errors, choices and confirmation/recovery controls carry
`data-crow-essential`. A future optional-guidance preference must not suppress
these, validation guards, or manually opened information buttons. Optional hints
can be controlled separately. No guidance toggle or layout redesign is added here.
