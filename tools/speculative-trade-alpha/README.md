# Speculative Trade — Alpha · Under Construction

Standalone browser prototype for Mongoose Traveller 2e house rules inspired by GURPS Far Trader. The catalogue links to this working entry. No merge or deployment is included.

## Working contract

Settings version: `first-playtest-2026-10-16-q125-expertise12`. Authority: complete 32-page rules draft v35 and verified portable math handoff. Runtime uses checked-in data, without private documents/accounts.

- q1.25 multiplies only the positive budget gap; no loss catch-up.
- Base Broker3 adds +1 and base4 adds +2 to sales only. Stat applies normally; search uses natural skill plus stat. Above4 remains unresolved.
- Raw2D6 selects risk; negotiation is additive, center5, capped at ±10pp.
- Departure inputs, original costs, individual dice and quotes persist. Display cents do not round the rational ledger.
- Tax combines per-visit actual cargo gains after purchase costs and selling fees. Next bracket begins Cr75,001. No stacked gross duty.
- Nonpositive gains use an explicit provisional zero-tax/no-refund setting. Fractional bracket gaps, missing government mappings and rates requiring additional dice block settlement.
- Shared-baseline freight premium remains an explicit engine trial; it is off in this screen and in the supplied zero-target sequence fixtures.

The public math contract omits private source URLs. Source chart: Merchant Prince2010 pp86–87, using the adopted purchase-cost/fees/per-visit house adaptation. Far Trader pp40,66 informs the illustrative handling/wharfage reference; screen fees are entered by the GM.

## Playtest boundary

GM setup accepts cargo hold, starting cash, actual mortgage/other expenses, target, separate Broker/stat and opposition/local knowledge. Generate offerings from GM-entered size/value/risk, buy whole lots, select a world, explicitly record freight/travel, search for buyers, retain separate sale quotes, then review a consolidated port settlement. Every second recorded jump assesses monthly bills; unpaid bills stop the test. This is not full ship operations.

Unresolved features remain transparently disabled: random offering tables/counts, refresh timing, conventional search retry schedule, onward carry calibration, partial sales, cargo/world affinities, Data Net workflow, complications, route reachability, travel time/fuel and integrated ship operations. Holding retains cargo and quotes without rerolls. Onward trading with held cargo needs a ruling. All cargo at a visit settles together in this first screen.

Player Audit buttons show plain-language dice, modifiers and arithmetic without commands, saves, charges or rolls. Private targets, calibration, full records and backups require explicit GM view. This is a presentation boundary, not access control: the local GM save contains private settings and is not a player-safe export.

## Reusable modules

- engine.mjs: explicit-input rational calibration/quote/search/tax/settlement and auditable seeded dice; no DOM/storage/map.
- session.mjs: JSON-safe standalone transitions and validation, separate from the live calculator schema.
- persistence.mjs: injected storage/exclusive-owner boundary, expected bytes, command IDs, retained candidate retry, uncertain-outcome reload and validated backup recovery.
- map-adapter.mjs: common live/backup normalization and radius filtering.
- app.mjs: browser forms, presentation and read-only audits.

Existing exact arithmetic, world transport/hex distance, UWP trade codes and planet decoding are reused without editing the calculator. Future tools compose the same modules. No framework, backend, campaign migration or broad extraction.

## World source

Live Traveller Map jumpworlds API, M1105, radius1–4pc. Fallback uses the existing public trojan-reach-m1105 fixture captured2026-10-09 (documented in campaign-baseline.mjs; repository commit7ceba0c). Its127 worlds cover parts of Trojan Reach and Reft, x−119…−95/y−29…−6; those bounds do not imply complete coverage. The bundled copy contains only public world data. Both paths normalize/filter identically. Backup use displays source/date/partial coverage. Missing world/local coverage returns an error. No synthetic universe is substituted.

## Verification

From repository root:

```sh
node --test tools/speculative-trade-alpha/verification/*.test.mjs
python3 tools/trade-route-calculator/verification/check_rules.py
node --test tests/tool-visits.test.cjs
python3 -m http.server 8765 --bind 127.0.0.1
# Separate terminal; pass an installed Playwright package if needed:
node tools/speculative-trade-alpha/verification/browser.mjs /path/to/playwright
```

TRAVELLER_ALPHA_URL overrides the served URL. TRAVELLER_BROWSER_CHANNEL selects an installed browser; local checks used Edge, CI uses pinned Chromium. CI also runs the original calculator aggregate runner. No separate lint/type configuration exists for this vanilla-module tool; module syntax is checked.

Confirmed:254 headless tests,227 existing rules checks,1 catalogue integration test,23 browser checks. Headless cases include20 supplied atomic fixtures and216 sequences/2,096 jump ledgers. Original atomic/sequence/dice SHA256 hashes match; the216 cases share12 paths and are not independent probability samples. Save tests cover repeats, known-unwritten retry, write-then-throw, uncertain reads, stale editors, malformed import and earlier-backup replay. Browser tests cover cancellation/navigation/reload, individual manual dice, save failure/recovery,390px layout, player-audit privacy and actual dated backup fallback. Screenshots/report are generated under ignored verification-artifacts.

Independent review found and verified fixes for import command collisions, unsafe search rendering, government/target defaults and corrupt-save recovery. No remaining code blockers were reported. Existing calculator source is unchanged; its full browser matrix was not run. The complete existing calculator native suite passed6,587 tests after restoring repository LF bytes in this isolated Windows clone. The initial CRLF harness failure is superseded by that passing run.
