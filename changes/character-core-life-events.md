# Core life events

Core Rulebook Update 2022 p. 46 life and unusual event routes are now native for Core careers, pre-career education, the Companion callers and Aslan Outcast. No source passages are bundled.

- Secondary dice use the existing deterministic audit and replay system. Each table result has its own sourced record; interrupted injury, speciality and decision steps retain the caller's continuation.
- Printed skill, relationship and qualification outcomes use existing mechanical handlers. Betrayal explicitly identifies the Contact or Ally converted, or adds a new Rival/Enemy only when neither exists.
- Good Fortune creates an optional +2 bonus selected for one later cash or material Benefit roll. It is not consumed until selected. Crime offers one Benefit-roll loss or the forced next Prisoner career. A loss is reserved against the originating career's final benefits rather than disappearing when the first-term counter is still zero. An education-origin loss is carried to the next available career benefits. No negative counters are created.
- Crime’s Prisoner option preserves the current term’s ordinary advancement and earned training (Core p. 18), then enforces the next-term transfer (p. 46), including when advancement rolls a natural 12. Existing mishap exits remain immediate.
- Narrative decisions and artefacts use strict typed inputs. Artefact records do not invent price, TL, powers or skill effects.
- Institute testing is optional. Testing funding and timing need an explicit decision (testing procedure: Core p. 228). Existing PSI is never rerolled, ordinary testing must be funded, and no training, talents, debt or extra elapsed generation term is invented. Positive PSI opens a source-specific next-term Psion attempt subject to ordinary qualification, not permanent unrestricted entry.
- Typed decisions and assets appear on the printable sheet and in the mandatory change audit. Generic source-effect edits cannot bypass these decisions.

## API additions

`resolve-life-event` requires a pending `core-life-decision`, `confirmed: true` and a nonempty `reason`. It accepts only the matching typed fields:

- narrative: `outcome` (birth/death, amnesia or government, as appropriate)
- ending/betrayal: `role` (Rival/Enemy), optional new `name`, or mandatory existing `relationshipId` when betrayal can convert a Contact/Ally
- artefact: `name`
- crime: `outcome` (lose-benefit/prisoner)
- psionics: `outcome` (decline/test); testing additionally requires `funding` (cash/provided), `cost` and `timingConfirmed`

The `benefit` command accepts optional distinct `lifeBonusIds` from available `character.lifeBenefitBonuses`. The engine validates availability and consumes each selected bonus once.

## Release integration

This commit deliberately leaves the shared rules revision unchanged for parent integration. The release must bump the revision and retain read-only recovery for earlier saves before publication, because adding secondary rolls changes historical RNG consumption.

Browser coverage is registered in the GitHub workflow for static and HTTP transport at desktop and 320px. Local browser execution was not attempted because this environment prohibits Chromium socket startup. The parent must verify CI for the integrated commit before merge or deployment.
