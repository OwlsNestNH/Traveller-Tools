# Vehicle Builder help audit — 2026-11-03

## Reported gap

The reported TL9, 12-Space Frontier utility rover shows ten feature choices.
Fresh live reproduction confirmed that their Info buttons opened, but Agile
only repeated “Locomotion optimised for greater Agility” and Fast only said
“Trades bigger engine for less fuel”. This is sparse feature content, not a
blank-dialog or stale-cache explanation. The previous equipment-help update
left these separate feature templates unchanged.

Feature help now gives purpose, numerical effects, cost, internal-Space and
range implications, prerequisites, conflicts, current fitting state and sources.
Agile specifically explains Agility +1, +100% baseline cost (Cr9,000 for the
reported rover), unchanged top speed/range and no additional internal allocation.

## Coverage by section

| Area | Help audited or added |
| --- | --- |
| Chassis | Vehicle type, TL, nominal Spaces; conditional lifting gas/depth; global design name |
| Features | All 29 feature descriptions; exact ten reported choices exercised by browser tests; incompatible saved choices retain help and removal |
| Power & mobility | Primary/secondary power, extra reactor Spaces, speed/efficiency/fuel changes, both auxiliary slots; conditional structure ruling, rail grade and vacuum tube |
| Armour & hull | Added armour, hull type, all six face transfers |
| Crew & cargo | Crew/main passenger counts and allocations, sophont size, drone toggle, additional group label/count/allocation, cargo and notes |
| Comfort display | Existing overall-average formula explained beside crew and record summaries; no comfort calculation changes |
| Weapon mounts | Weapon, mount, facing, linked quantity, fire control, reserve count/type, shield, loaders, remote/autoloader/pop-up/modular; empty-mount capacity and crew |
| Core systems | Control system/stations; every existing system-family choice; sensor settings and quantity; search/category filters |
| External options | Existing catalogue help plus individual manipulator characteristic and quantity inputs |
| Internal options | Existing catalogue help plus quantity inputs; bay quantity label corrected to carried-vehicle shipping tons, matching the unchanged calculation |
| Computers & automation | Existing purpose/specification/limit help and quantity inputs |
| Installed equipment | Purpose/specification help for each installed item and context-specific quantity help |
| Record & checks | Existing printed statistics, rule checks, references and ledger retained; average comfort help added; help controls hidden when printing |

## Verification scope

`feature-help-tests.cjs` checks the exact reported features against independently
expected benefits/trade-offs and the unchanged engine. It also covers all 29
feature descriptions and editable input families. `option-help-tests.cjs` keeps
the full equipment/enum coverage and absence of generic catalogue fallback.

Browser regression opens every reported feature popup, checks its concrete
benefit and restriction, changes Agile fitting state, checks keyboard focus and
captures Agile/Fast/Monowheel previews. A separate synthetic draft audits every
rendered editable control across all sections for adjacent substantive help,
including passenger groups, installed quantities and empty-turret controls.

Calculation code and reference tables are unchanged. Narrative help distinguishes
nominal feature adjustments from final totals after other selections and caps.
Operational effects already present in the reference text remain descriptions;
this update does not add combat or movement-resolution automation.
