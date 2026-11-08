# Coverage and release gates

Status: local development/source-assisted preview. A data table being present does not mean every resulting rule is automated. The UI must preserve this distinction.

## Source scope

- Core Rulebook Update 2022: 12 principal careers, Prisoner and Psion; University and three military academies.
- Traveller Companion Update 2024: two careers and five pre-career pathways; selected optional characteristics.
- Aliens of Charted Space Volume 1 Update 2026: Aslan, Vargr and Zhodani species/careers. K'kree deliberately excluded.
- Journal of the Travellers' Aid Society Volume 11: Aezorgh species rules, using applicable Core/Vargr career paths.

These edition choices matter. In particular the 2026 Aslan characteristic modifiers differ from earlier sources. Short numeric representations carry page references. `SOURCE_DISCREPANCIES` records conflicting summary/detail entries rather than pretending the books are perfectly consistent.

## Implemented infrastructure

- Independent versioned JSON rules API and optional localhost HTTP adapter.
- Original, readable responsive interface with large controls.
- Always-on deterministic event log; save, import, print and GM-gated audit-preserving restore.
- Logged GM changes and replacement dice, with reason and retained original record.
- Requested boon, placement, below-43 and extra-characteristic controls.
- Species-specific stat formulas, basic backgrounds and career filtering.
- Numeric training, rank, material/cash benefit, event and mishap tables for all 45 scoped careers.
- Native Core University/academy entry, initial awards, events, graduation/honours, deferred service awards, future entry/qualification rights and pre-term commissions, with explicit source-assisted exceptions.
- Native five Companion education paths, constrained awards, graduation and persisted career rights, with explicit cross-book and psionic exceptions.
- Native ordinary injuries, partial restoration, listed employer contributions, source adjudication for unlisted employers/zero scores, and end-of-creation medical bill settlement. Ageing crisis funding remains a separate explicit decision.
- Vargr strain overlays, native/Imperial social statistics, Aezorgh derived Charisma, and the published Aslan rite-of-passage double results.
- Native ordered Core/Zhodani talent acquisition, persistent check penalties, source-based career retry opportunities, initial Zhodani training and career elevation. Companion childhood training reuses the same workflow. Institute access, costs and chronology are explicitly approved rather than assumed.
- Source-keyed named benefits, stable equipment/ship assets, same-table duplicate Scout rerolls, same-ship mortgage progress, bounded equipment selections, recurring Patronage and culture-specific pensions. Book decisions remain explicit for ambiguous definitions and ship history.
- Bounded native Psionic Games at an existing-career term boundary: lifetime application, ordered talent checks, final, explicit event/award rulings, one replacement term, inherited benefits and due ageing. Initial-career entry timing and complex ordinary event consequences remain outside this route.
- Derived before/after action details, printable notes/connections and medical ledger.
- Ten additional shared alien event tables and explicit constrained-effect metadata.
- Pure Core medical, injury, ageing, pension and benefit procedures with source-grounded tests.

## Automation boundaries

Routine training, checks, table rolls, many choices, rank awards and benefits are automated. Unsupported effect kinds and special source routes must stop at a source-assisted step with a reference. They must never be treated as successful no-ops.

Important areas still needing integration, deeper testing or source adjudication include:

- Companion cross-book exceptions, source-specific career transfers and assignment changes.
- Psionic acquisition histories from older/manual records, repeat-course chronology and untraceable retry awards require source decisions. Zhodani re-education and wider status-review procedures remain incomplete. Games source ambiguities are explicit rulings, not silently selected defaults.
- Detailed Aslan rite/clan/land/share procedures and constrained gender/culture paths.
- Non-standard Vargr and Aezorgh cross-book choices, derived social characteristics and career restrictions.
- Nonstandard injury/medical rules, detailed equipment verification, ambiguous ship-history procedures and unimplemented bespoke benefits. Clan Shares remain unconverted entitlements; land/corporation/redemption choices need further handling.
- Automatic event commissions at SOC below 9 after the first term retain ordinary eligibility pending a source ruling. Zhodani pension amounts record their exit-class basis; later class changes flag a source review rather than silently changing entitlement.
- Event branches requiring wagers, custom checks, referee choices, prior-history changes or future conditional obligations.
- Optional characteristic consequences throughout careers. Displaying Luck/Morale/Wealth is not a claim that every optional rule using it is automated.
- Deeper full-character and multi-career golden scenarios. White-box continuation stress covers all career assignments but bypasses qualification/species setup and stops at source-assisted decisions.
- Optional anagathics, post-career purchases and campaign group-skill packages are not fully automated.

Some of these have data/helper implementations but are not yet wired into all engine/UI paths. Inspect the current integration tests and actual stop points before relying on an area above.

Manual resolution is an acknowledged development fallback, not equivalent to fully implemented rules. A note alone cannot reliably encode every deferred permission, prohibition, transfer or talent condition. Such cases require continued engineering rather than advertising a fully automated result.

## Release gates

1. Close or explicitly scope each remaining mechanical gap. Do not silently claim full Core/Companion/alien support.
2. Run all engine, integration, API and browser tests against the exact candidate revision. Add multi-term golden scenarios and malformed-save regressions.
3. Complete independent rules/code review and fix material findings. Re-run review after consequential changes.
4. Test desktop and narrow/mobile layouts, keyboard focus, screen-reader announcements, save/load, printing and meaningful failure recovery.
5. Resolve publisher permission/notification for this multi-book tool. Do not assume a general repository notice establishes clearance. Use the current publisher terms and obtain any needed scope approval before public distribution.
6. Only then create the approved release PR/merge/deployment. Keep robot/trade work isolated and verify the current main branch before integration.

## Test evidence

Run `node --test tools/character-generator/verification/*.test.mjs` for the current unit/integration/API result. Run `verification/browser.mjs` with Playwright for desktop/mobile evidence. Generated results and screenshots are local artifacts, not a substitute for a source-rule review. Do not infer full correctness merely from all existing tests passing.
