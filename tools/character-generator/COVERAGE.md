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
- Always-on deterministic event log; rules-revision-pinned save/import, print and GM-gated audit-preserving restore. Unversioned or different-revision files are preserved for unverified read-only history recovery; historical mechanics are never silently reinterpreted.
- Logged GM changes and replacement dice, with reason and retained original record.
- Requested first-roll boons, placement, minimum-total rerolls and extra-characteristic controls. Standard Aezorgh use30; their optional six-2D6 method uses43 before placement/halving, free swaps and destination-specific rounding down. Both are explicitly labelled house options.
- Species-specific stat formulas, basic backgrounds and career filtering.
- Numeric training, rank, material/cash benefit, event and mishap tables for all 45 scoped careers.
- Native Core University/academy entry, initial awards, events, graduation/honours, deferred service awards, future entry/qualification rights and pre-term commissions, with explicit source-assisted exceptions.
- Native five Companion education paths, constrained awards, graduation and persisted career rights, with explicit cross-book and psionic exceptions.
- Native ordinary injuries, partial restoration, listed employer contributions, source adjudication for unlisted employers/zero scores, and end-of-creation medical bill settlement. Ageing crisis funding remains a separate explicit decision.
- Vargr strain overlays, native/Imperial social statistics, Aezorgh derived Charisma, and the published Aslan rite-of-passage double results.
- Native ordered Core/Zhodani talent acquisition, persistent check penalties, source-based career retry opportunities, initial Zhodani training and career elevation. Companion childhood training reuses the same workflow. Institute access, costs and chronology are explicitly approved rather than assumed.
- Source-keyed named benefits, stable equipment/ship assets, same-table duplicate Scout rerolls, same-ship mortgage progress, bounded equipment selections, recurring Patronage and culture-specific pensions. Book decisions remain explicit for ambiguous definitions and ship history.
- Persisted, next-term alien transfer rights for Zhodani Army to Guard, Guard to Agent, Merchant to Navy and Vargr Loner to Spacer/Corsair. Source rank/assignment and expiry conditions are retained. Merchant-to-Navy rank track remains an explicit referee decision, rather than an assumed officer commission.
- Bounded native Psionic Games at an existing-career term boundary: lifetime application, ordered talent checks, final, explicit event/award rulings, one replacement term, inherited benefits and due ageing. Initial-career entry timing and complex ordinary event consequences remain outside this route.
- Native Zhodani career PSI elevation and re-education outcomes, with explicit referee decisions for unprinted modified results, sub-year durations, treatment chronology, contradictory discharge, insufficient fine funding and END zero. Separate non-career time and ageing credit preserve career training, advancement, benefits and pension accounting. Ordered treatment/term ageing resumes the saved context; age-caused permanent PSI loss retains historical talent records.
- Native Zhodani Merchant mishap fine: one logged die, immediate affordable cash payment or explicit decline, retained source/protected-event context, and linked Prole re-education. The original and any later treatment fine are distinct records. Nonpayment versus row2 continuation requires a typed precedence ruling unless protected by the source event. No automatic financing or duplicate charge.
- Native Prole Ally/Contact removal before re-education, including exact removed-entry history and an explicit empty-roster ruling. Scholar secret research enforces two distinct Science specialities across save/replay and interrupted choices. Government mishap checks let the player choose PSI, Melee or Recon and preserve injury/stay consequences without an extra Event after failed survival.
- Native Aslan origin setup after accepted final statistics: immutable family SOC/provenance, supplemental family awards, source birth-order dice, separate family-estate minimum, clan/scope and pride rolls, ordinary background skills then rite. Explicit GM decisions cover unprinted family/estate values, female Independence and unsupported mechanical gender branches while preserving the chosen identity. Estate and inheritance records never grant personal ownership by inference. Family Outcast classification is not past career history.
- Native Aslan event-earned officer-entry offers from Military Event 10 and Spacer Events 5/10: following-term timing, originating-career term DM, targeted minimum-service waiver, one set of exit benefits and a fresh rank-zero officer career. Forced stay remains binding. Early cancellation can retire, while independently legal exits may return to career selection. Female Space Officer rank headings and historical status exceptions remain explicit, GM-enabled source decisions; neither is guessed.
- Audited native Aslan Outcast status and held Clan Share forfeiture on voluntary entry, qualification failure and explicit status effects, including shares just received during mustering out. Original award records remain annotated; unrelated benefits and cash are retained. Already-redeemed assets are not repossessed by inference.
- Outcast Event 11 restoration with GM-verified original SOC, an explicit status-timing ruling, a single next-term qualification right and preserved forfeiture history.
- Outlaw Event 11 has separate male restoration/three-Share and female marriage/normal-2D-SOC procedures, with verified original SOC or marriage eligibility, mandatory departure, normal ageing and exactly one benefit settlement. Any restored historical career access remains a separate typed GM ruling for one requested normal qualification attempt; it is not an inferred permanent unlock.
- Core p. 20 assignment changes for the eleven explicitly named careers: retained-rank checks start the next term, while restart paths finish benefits before fresh qualification. Historical assignments, officer/highest-rank state and the lifetime cash count are preserved. Core Noble SOC 10+ qualification is automatic. Unsupported career categories are not guessed.
- Native Agent undercover routing preserves nested Prole Event/Mishap source identity while retaining Agent career accounting, with one chosen Prole assignment roll only after success. Re-education, skill interruptions and terminal outcomes preserve the original continuation.
- Native Government advisory service uses a dropdown for another Zhodani career, its Service Skills roll and an immediate same-career cash benefit. This is the selected interpretation of the source wording. Cash counts toward the normal lifetime limit; a full cap preserves the award pending an explicit logged GM waiver or override. Government rank/scoped modifiers and ordinary benefits are not consumed. Gambler, selected global credits and optional WLT are accounted for separately.
- Prole Event 3 global and Event 4 career-restricted one-roll benefit credits have stable identities and explicit selection; unselected credits remain available. Unprinted advisory cash results retain the die, modifier, credit use and cash-roll count until a typed GM amount ruling.
- Derived before/after action details include treatment time, source decisions, fine/payment ledgers, status reviews, permanent PSI loss and transfer rights without dumping internal rule queues. Printable notes/connections and medical ledger.
- Ten additional shared alien event tables and explicit constrained-effect metadata.
- Pure Core medical, injury, ageing, pension and benefit procedures with source-grounded tests.

## Automation boundaries

Ordinary failed-survival mishaps that permit staying close the term under the specific Core2022 p14 flowchart. The general p18 Events paragraph is not treated as permission for an extra Event in that branch. Protected Event2 mishaps resume their existing after-event queue; Prisoner retains its explicit p52 advancement exception.

Routine training, checks, table rolls, many choices, rank awards and benefits are automated. Unsupported effect kinds and special source routes must stop at a source-assisted step with a reference. They must never be treated as successful no-ops.

Important areas still needing integration, deeper testing or source adjudication include:

- Companion cross-book exceptions, career transfers outside the four explicitly implemented routes, and assignment changes outside the eleven explicitly classified Core careers.
- Psionic acquisition histories from older/manual records, repeat-course chronology and untraceable retry awards require source decisions. Zhodani re-education covers supported source-earned triggers and all six outcomes, but unresolved source timing and consequence ambiguities remain typed referee decisions. The implemented Agent and Government wrappers retain explicit decisions only for source interruptions or unprinted outcomes. Wider setting-level status, suppression and anagathic history are not universal automatic rules. Games source ambiguities are explicit rulings, not silently selected defaults.
- Owned Aslan estates, inheritance timing, Clan Share redemption and wider gender/culture career restrictions. Native family/clan/pride setup and ordered rite handling are implemented, but do not establish complete Aslan generation.
- Non-standard Vargr and Aezorgh cross-book choices, derived social characteristics and career restrictions.
- Nonstandard injury/medical rules, detailed equipment verification, ambiguous ship-history procedures and unimplemented bespoke benefits. Clan Shares remain unconverted entitlements; land/corporation/redemption choices need further handling.
- Automatic event commissions at SOC below 9 after the first term retain ordinary eligibility pending a source ruling. Zhodani pension amounts record their exit-class basis; later class changes flag a source review rather than silently changing entitlement.
- Event branches requiring wagers, custom checks, referee choices, prior-history changes or future conditional obligations. Other discretionary benefit-modifier awards still need a source-by-source review of eligibility and player-selected timing beyond the two implemented Prole credits.
- Optional characteristic consequences throughout careers. Displaying Luck/Morale/Wealth is not a claim that every optional rule using it is automated.
- Deeper full-character and multi-career coverage beyond the bounded public-API golden scenarios. White-box continuation stress covers all career assignments but bypasses qualification/species setup and stops at source-assisted decisions.
- Optional anagathics, post-career purchases and campaign group-skill packages are not fully automated.

Some of these have data/helper implementations but are not yet wired into all engine/UI paths. Inspect the current integration tests and actual stop points before relying on an area above.

Manual resolution is an acknowledged development fallback, not equivalent to fully implemented rules. A note alone cannot reliably encode every deferred permission, prohibition, transfer or talent condition. Such cases require continued engineering rather than advertising a fully automated result.

## Release gates

1. Close or explicitly scope each remaining mechanical gap. Do not silently claim full Core/Companion/alien support.
2. Run all engine, integration, API and browser tests against the exact candidate revision. Add multi-term golden scenarios and malformed-save regressions.
3. Complete independent rules/code review and fix material findings. Re-run review after consequential changes.
4. Test desktop and narrow/mobile layouts, keyboard focus, screen-reader announcements, save/load, printing and meaningful failure recovery.
5. Retain the prescribed publisher notice and review actual distributed content against the current policy. The site operator reports that Mongoose is aware of the site and handles publisher correspondence. Do not display full table pages or copied explanations. Document that public source files and static deployments expose the executable mappings; a labels-only interface is not source confidentiality. Do not represent publisher endorsement.
6. Candidate branches and draft PRs may be used for CI under the user's authorization. Merge/deployment must wait for required tests and review, with any remaining source-assisted scope explicitly stated. Keep robot/trade work isolated and verify the current main branch before integration.

## Test evidence

Run `node --test tools/character-generator/verification/*.test.mjs` for the current unit/integration/API result. Run `verification/browser.mjs` with Playwright for desktop/mobile evidence. Generated results and screenshots are local artifacts, not a substitute for a source-rule review. Do not infer full correctness merely from all existing tests passing.
