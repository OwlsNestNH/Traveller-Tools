# Traveller Trade Route Calculator — Handoff

**Updated:** 2026-10-06  
**Repository:** [OwlsNestNH/Traveller-Tools](https://github.com/OwlsNestNH/Traveller-Tools)  
**Tool folder:** `tools/trade-route-calculator/`  
**Current main reviewed:** `ad4c01adbe0cfcecff586b6d19b7300453314523`

Use the current GitHub files as the source of truth. This handoff summarizes continuity; it does not replace the requirements, rules decisions, verification record, or backlog.

## Current state

The calculator is an implemented, free static web app published from GitHub Pages. It uses HTML, CSS and vanilla JavaScript, Traveller Map's public API for world/navigation data, localStorage for browser campaigns, and JSON export/import for backups. There is no app backend, cloud campaign, database, paid service, user account, PDF access, or dependency on the design conversation. Campaign data stays in the user's browser; Traveller Map supplies world/navigation data, not trade rules.

The implementation is version 0.1.0. The Core Rulebook source/data gate and initial automated application checks are recorded as complete. Campaign playtesting remains open. Read [README.md](README.md), [REQUIREMENTS.md](REQUIREMENTS.md), [ARCHITECTURE.md](ARCHITECTURE.md), [RULES_REVIEW.md](RULES_REVIEW.md), [RULES_VERIFICATION.md](RULES_VERIFICATION.md), [OPTIONAL_RULES.md](OPTIONAL_RULES.md), and [BACKLOG.md](BACKLOG.md) before changing behavior.

## Working rules

- Treat GitHub's checked-in requirements and decision records as authoritative; do not rely on this conversation or private files.
- The deployed app must not access, embed, link to, or require rulebook PDFs or personal references. Keep source references and verified rules data in GitHub.
- Ask the owner when a rules ambiguity is unresolved. Record agreed conclusions in the rules decision register and interface notes.
- `tools/spec-trade/` is buggy/untrusted and is not rules authority. Independently verify any reused code or data against the Core Rulebook.
- Keep the separately downloaded `code-monki/trav-trade-sim` independent. It may inspire ideas; no copying or integration was authorized.
- Preserve existing repository content and review current `main` before committing. App behavior and user campaign data are separate; do not alter user data during code changes.
- The owner asked to keep work minimal while weekly usage is low. Flag unusually high-effort work before starting; ordinary questions and small documentation changes can proceed.

## Implemented behavior to preserve

The app includes searchable sector → subsector → world selection, M1105 map data, clickable hex map and route planning. Browsing worlds is separate from the ship's actual location; only **COMMIT JUMP** moves the ship. Auto plot uses the configured jump rating, and manual route building keeps clicked stops in order. Day controls are already implemented: +1 day advances time and consumes life support; -1 day moves the date back without restoring supplies or undoing transactions; Undo reverses an accidental advance.

The trade tool includes local UWP parsing/trade-code derivation, editable overrides, generated commodity availability/pricing, per-commodity modifier audits, manual overrides, local brokers and fees, illegal goods, separate cargo lots, market snapshots/search history, freight/mail contracts, bank ledger, expenses/deposits, campaign History filters, JSON backup/import, and undo. RAW 100% is the default profit mode; Reduced applies 75% to positive profit and leaves losses unchanged. Approved first-edition Merchant Prince insurance and tax options are separate and off by default. Cabin/person charges, life support and jump-fuel tracking are documented in the app and requirements.

For exact rules, rounding and accounting behavior, use the checked-in decision/data records rather than paraphrasing this list.

## Open follow-up to clarify

The owner previously reported that mail was not visible in the availability/available-lots experience and asked whether something had broken. The existing contract search includes a mail roll and the result/audit is recorded, but the mail availability outcome was not prominent as a distinct result. The owner then investigated a separate simulator; no explicit instruction to implement a mail-panel change followed. If this comes up again, first inspect the current implementation and ask whether they want the mail result displayed separately before changing scope.

Other future ideas are in [BACKLOG.md](BACKLOG.md). In particular, optional cloud campaigns are deferred: retain the local browser mode and JSON backups; do not build backend/accounts now. Cloudflare Workers/D1 were proposed as a possible free-tier option, but recheck current quotas and get an explicit scope decision before any implementation or paid service.

## Suggested next steps for a new conversation

1. Fetch the current `main` state and review the latest relevant code/docs; this handoff may become stale.
2. Ask what the owner wants to work on next, or continue only the specific task they request.
3. For reported bugs, reproduce against current code, explain the observed cause briefly, make the narrow fix, and run the relevant existing checks. Do not claim the published site changed until deployment is verified.
4. For rule changes, identify the affected decision, verify the source/data, ask about ambiguity, then update requirements, rules data, audit text, and tests as appropriate.

## Price limits: verification and release approval (2026-10-08)

Optional independent purchase floor/sale ceiling implemented, disabled by default, with 85%/115% defaults. Whole-number inputs 0–400, step 1; custom values survive toggles. Percentages apply before Credit conversion/rounding and broker fees, using the existing effective base retail. Profit mode remains separate. Schema 1 is retained; validation supplies disabled legacy defaults and rejects malformed values. Saved offer terms and referee overrides are preserved. See README and REQUIREMENTS for semantics.

Fresh isolated-cloud QA supplied by the coordinating task was performed on exact feature commit `98ffa09fd0d894d2e6020ba2d6d19a7da0772bbb`; all 64 files were verified against Git blob hashes:
- Native Node: all 12 focused price-limit tests passed, including fees, independent base-retail cap and illegal-goods exception. Existing application tests: 30 passed; two routing failures reproduced on the unchanged baseline. Routing code is unchanged.
- Python rules check: 198 assertions passed. Application syntax check passed.
- Cloud Chromium: default off with 85/115; visible native number steppers, step 1, bounds 0–400; invalid-value rejection; custom 91/109 retained through toggling, save and reload; Cancel discarded unsaved edits. Cr500 base-retail cap and 75% profit mode remained unchanged.
- Full browser regression suite was NOT run. The private preview was stopped.

The original local command runner still failed before PowerShell started (`helper_unknown_error: setup refresh had errors`), including a login-disabled retry. That local limitation does not negate the subsequent native cloud checks above. Local memories, checkout status and local instructions remained inaccessible; implementation used pinned GitHub sources and preserved unrelated local files.

The user explicitly approved merging PR #2 and publishing the tested feature after Git rollback was explained. Release verification must confirm the remote merge commit, successful Pages deployment and live controls. Git preserves code history; this is not a backup of browser campaign data.
