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
- Back, including Back offered by Crow warnings, reviews accepted screens without
  applying a `restore` command or granting GM permission. Explicit GM Tools
  corrections remain separate, with their existing confirmation, retained original
  history and permission checks. Never silently enable GM mode.
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

## Read-only recorded-screen review

The regular and Crow-warning Back controls are distinct from GM restore. It renders earlier accepted
session prefixes in a separate same-origin read-only frame. Back, Forward,
Return to current and Cancel never send a command or persist a prefix. New
Character invokes the existing separately confirmed fresh-start action. The
current live DOM, accepted session, notes and unfinished form choices stay in
place underneath review.

Frames receive their prefix only after a source/origin/token-checked handshake;
no character JSON appears in a URL. Replacing a frame creates a fresh document
and ignores stale messages. Static review permits catalog/project/import only;
commands, creation, storage writes and visit-counter reporting are blocked.
The iframe is trusted application code, not a security boundary against hostile
same-origin scripts. Ordinary information controls remain accessible; inputs
and mutation buttons are locked. Known recorded choices are explicitly
annotated before their accepted action, without predicting awards. Forward
shows the accepted outcome. Unrecorded transient visits cannot be reconstructed
from a save. Original log/history remains the evidence for unsupported form
annotations and historical source rulings.

Application/engine-module failures use the existing factual default-Crow
recovery inside the frame. A failed frame navigation uses the parent's factual
Crow with explicit retry/return actions. Retry replaces or reloads only the
review document; it never repeats an accepted action or reloads the current
parent character. No automatic retries are added.

Coverage is representative, not exhaustive: current Army, Aslan origin/Military
and Vargr qualification prefixes; sampled benefit/finish/retirement/fatal-referee
histories; desktop/phone static/API saves, focus, keyboard, drafts and reload.
Full career/state visual certification remains a separate incomplete audit.

Generic Cancel inside the career/education/completion panel invokes that panel’s
existing presentation Close handler. It does not open a new-character/reset
confirmation. Command-specific equipment/source cancellation is unchanged;
outside-popup confirmed cancellation and global New Character remain separate.
