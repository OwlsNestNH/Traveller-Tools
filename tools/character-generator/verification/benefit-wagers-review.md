# Bounded benefit-wager verification

Source review: Core Rulebook 2022 pp.35/41 and Aliens of Charted Space 2026 p.29. Source PDFs were re-extracted locally and matched the supplied text files. No licensed source content is included here.

Implemented scope:
- Core Merchant event 5: explicit Gambler/Broker choice, 8+, success adds rounded-up half stake, failure loses stake, selected skill increases after either rolled result.
- Core Rogue event 10: unconditional Gambler 1 retained; optional Gambler 8+ wager, rounded-up half-stake reward.
- Aslan Manager event 5: Broker 8+, maximum three, equal-stake reward.
- Only accrued, unspent active-career rolls are available. No future rank/unfinished-term rolls, other-career rolls or negative balances/loans.
- Refusal is explicit, consumes no randomness and does not grant Merchant training.
- Source/career/index/assignment and original continuation retained; typed command, audit ledger and printable summary. Skill-cap conflicts retain the existing source-assisted award boundary.

Local checks:
- 1,127 aggregate engine/API tests passed.
- Focused wager and Core pack tests: 41 passed.
- Full 45-career / 134-assignment / 2,680-scenario smoke: zero failures; 23 wager-stage visits.
- Syntax checks and whitespace validation passed.
- Browser suite added to the existing CI job: 24 cases (3 careers × 2 decisions × 2 widths × static/HTTP), persistence/reload, source context, no duplicate outcome and no horizontal overflow. Chromium was not run locally, per the execution constraint. Browser results/screenshots remain pending CI.

Public-candidate publication and rules-revision changes are coordinated separately. This patch neither publishes nor merges/deploys.
