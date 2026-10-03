# Appendix I verification

Tested against **Vehicle Handbook Update 2026, Appendix I, printed pp176–181**. The PDF tables on printed p180 were also visually checked. The saved fixture is appendix-i-design.json and can be opened in the builder. Existing example vehicles outside this appendix were not used.

17/17 checks passed. This means the described build matches the explicit rules and the listed comparisons; it does **not** mean the appendix has no discrepancies. Appendix I does not exercise every newly added option; the separate construction suite covers radio and sensor upgrades, life support, bays, fibre optics, ammunition and other additions.

## Builder issue corrected

The example intentionally has no dedicated loader in its remote autocannon turret (p178). The builder formerly reserved a loader berth unconditionally. Assigned loaders are now configurable. Zero assigned loaders consumes no loader berth; missing loaders double reload time per p102. Default full staffing still includes the required loader. This produces the appendix's one-Space, Cr75000 turret without ignoring the general rule.

## Matching results

| Item | Result | Book and printed pages |
|---|---|---|
| Hull / Structure | 66 / 7 | Vehicle Handbook Update 2026, pp6,176–181 |
| Capacity | 20 / 20 Spaces | Vehicle Handbook Update 2026, pp177–179 |
| Crew / passengers | 3 / 10; 8 accommodation Spaces | Vehicle Handbook Update 2026, p179 |
| Agility; speed | +2; Medium / Slow cruise | Vehicle Handbook Update 2026, p181 |
| Maximum-speed range | 500 km | Vehicle Handbook Update 2026, pp176,181 |
| Armour cost and volume | Cr112500; 9 Spaces | Vehicle Handbook Update 2026, p177 |
| Front / aft / sides armour | 70 / 38 / 43 / 43 | Vehicle Handbook Update 2026, pp177,181 |
| Radio + encryption | 500 km, Cr4300 | Vehicle Handbook Update 2026, p177 |
| Sensors | 5 km; underwater 2.5 km; Cr45000 total | Vehicle Handbook Update 2026, p177 |
| Tow hitch | 20 powered towed Spaces, Cr400 | Vehicle Handbook Update 2026, p178 |
| Submerged endurance without life support | 3 hours | Vehicle Handbook Update 2026, pp33,178 |
| Autocannon turret | 1 Space, Cr75000, zero assigned loaders | Vehicle Handbook Update 2026, p178 |

## Appendix discrepancies retained as documented differences

| Item | Appendix | Builder / explicit rule | Book and printed pages |
|---|---|---|---|
| Dorsal / ventral armour | 24 / 24 | 25 / 25. Half of45 is22.5, rounded up to23, plus base3 minus transfer1. | Vehicle Handbook Update 2026, pp26,56,177,181 |
| Cruise range | 700 km | 750 km: 500 ×1.5. | Vehicle Handbook Update 2026, pp23,181 |
| Rocket-pod hardpoint | Cr24000 each in final rows; detailed p179 table is internally inconsistent | Cr26000 each: Cr12000 weapon + Cr4000 hardpoint (500kg =2 Spaces) + Cr10000 fire control. | Vehicle Handbook Update 2026, pp102,104,118,179–180 |
| Exact total cost | Cr481600 on worksheet; Cr480000 on display | Cr484100 using explicit rules. Replacing both pods with appendix Cr24000 produces Cr480100, still Cr1500 below the stated worksheet total. No unexplained correction is added. | Vehicle Handbook Update 2026, pp176–181 |
| Submarine speed | Idle on p180; Very Slow in equipment on p181 | Very Slow, using the equivalent submersible baseline. | Vehicle Handbook Update 2026, pp33,52,180–181 |

The TL7 autopilot can assist waterborne operation; it is not a fully capable ground-driving autopilot before TL9 (p58). That limitation is shown in the operational notes.

## Individual checks

- PASSED: 20-Space TL7 ground chassis and reinforced AFV Hull66 / Structure7 (pp176–181)
- PASSED: Feature price +530%, efficiency +50%, reinforced hull +50% (pp176–177)
- PASSED: Agility +2 with improved controls (p181)
- PASSED: Medium maximum, Slow cruise, range500 (p181)
- PASSED: Cruise range750 follows the explicit +50% rule (p23)
- PASSED: Nine Spaces and Cr112500 of added armour (p177)
- PASSED: Front70, aft38, sides43; upper/lower25 after p26 rounding
- PASSED: Submarine drive two Spaces, Cr60000, range75 (pp177–181)
- PASSED: Encrypted 500km radio Cr4300 at TL7 (p177)
- PASSED: Improved sensors 5km / underwater2.5km, combined Cr45000 (p177)
- PASSED: Tow hitch rated20 Cr400, hatch500, extinguishers400 (pp178–180)
- PASSED: Loader omitted deliberately: remote autocannon turret one Space, Cr75000 (p178)
- PASSED: Each 500kg rocket pod has a two-Space rated hardpoint (p102)
- PASSED: Three crew plus ten half-Space passengers use eight Spaces (p179)
- PASSED: Entire design exactly fills20 Spaces without invalid-state errors
- PASSED: No life support: three hours submerged endurance (p178)
- PASSED: Independent full cost sum with explicit p102 hardpoints
