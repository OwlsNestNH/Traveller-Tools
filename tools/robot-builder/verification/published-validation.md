# Published robot validation

Scope: Thirteen independently reconstructed Robot Handbook (Mongoose 2022) designs. The source was the complete original PDF, with positional extraction to preserve table identities. The Advanced Courier, Deep Diver and Zombie pages were also rendered and visually checked. This is representative validation, not verification of every published robot or every operating effect.

The fixtures retain component choices and assumptions. Tests distinguish construction cost from catalogue retail cost. Page 76 permits rounded prices, discounts and premiums; a price difference alone does not prove an error. No custom price overrides were used to force matches.

| Robot | Printed page | Component cost | Printed price | Comparison |
|---|---:|---:|---:|---|
| Domestic Servant | 179 | Cr 860 | Cr 500 | Hits, armour, speed, endurance, no arms and Recon match. Stat row says wheels despite tracked description. |
| AG 300 Agricultural Worker | 175 | Cr 24,950 | Cr 20,000 | Physical stats, four arms, Navigation and labourer skill match. |
| Basic Courier | 177 | Cr 31,900 | Cr 25,000 | Physical stats, High speed band, 24/6-hour endurance and navigation match. |
| Advanced Courier | 178 | Cr 132,500 | Cr 120,000 | Does not fit by one Slot. Vehicle endurance calculates 5 hours, not printed 12. |
| Autodoc, basic | 146 | Cr 110,650 | Cr 100,000 | Physical stats, resized arms, Medic 3, Science (biology) 2 and 32 spare Slots match. |
| Enhanced Android | 227 | Cr 2,117,200 | MCr 2 | Physical stats, arms, hardware skills, four spare Slots and three free Bandwidth match. |
| Entourage Biobot | 236 | Cr 392,100 | Cr 390,000 | Physical stats, arms and four spare Slots match. Art(write) is an explicit representative for printed Art(TBD). |
| Zombie | 238 | Cr 144,750 | Cr 100,000 | Physical stats and labourer skill match; four spare Slots calculate, not printed three. Existing biological body conversion is under-specified. |
| Sindalian Enforcement Robot | 141 | Cr 28,750 | Cr 27,000 | Physical stats and 4 D laser match. Basic fire control 1 and HK weapon software 0 remain separate. HK package Bandwidth interpretation is disclosed. |
| Deep Diver Droid | 155 | Cr 2,331,400 | MCr 2.3 | Physical stats, INT 9, listed skills and full equipment fit match. 108 hours describes reserve output, not decades of full-output RTG operation. |
| StarTek | 78 | Cr 697,300 | Cr 690,000 | Physical stats, skills, one spare Slot and one free Bandwidth match. Printed component total Cr 697,100 omits the separate Cr 200 stunner pack required by p 64 prose. |

## Unresolved source discrepancies

- Advanced Courier: Size 4 gives eight Base Slots. Removing both arms adds two. One pack, vehicle movement at Very Fast, navigation and storage need 1 + 4 + 1 + 5 = 11 Slots, exceeding the ten available. Its 72-hour reserve at two vehicle speed enhancements gives 72 / 4 / 2^2 = 4.5, rounded to 5 hours under p 23. The printed 12 hours does not follow that formula. Athletics(endurance)1 indicates one added pack under pp 19-20; replacing it with efficiency to force slot fit would remove that listed skill.
- Zombie: A Size 5 basic biological body reserves 75% of 16 Slots, or 12. Listed options and its Basic brain require no additional Slots at that size, leaving 4, not 3. No undisclosed component or special conversion rule was invented.
- StarTek: The worked example explicitly specifies a separate Cr 200 pack on p 64 but omits it from the p 75/p 78 total. The test keeps the fully equipped Cr 697,300 total.
- Retail price differences remain disclosed; rounding or discount policy does not prove the author's exact price choice.

## Coverage boundaries

The thirteen examples cover stationary, wheels, walker, grav, secondary walker and aquatic modes; Primitive, Basic, Hunter/Killer, Advanced, Very Advanced and Conscious brains; resized/extra/removed arms; robot skills and hardware skills; android and biological costs; armour, RTG, repeated pressure protection and mounted energy weapons. They do not establish full weapon-catalogue coverage, all operating dependencies, Self-Aware published examples, or every special construction path.

Other retained tests independently check 112 size/TL/arm-removal ledger combinations and 224 equipment TL/slot/rate rows against original PDF tables. The eight previously swapped Recon/Electronics p 58 numeric rows have been corrected. Scalar catalogue verification is not the same as complete implementation of every dependency or effect.

Microbot and clone comparisons are retained in the separate special-types tests. Their unresolved Nano Hero price and Underworker template/education assumptions must not be counted as exact complete matches.


## Additional high-technology source checks

- Ultima (p 257): Cr 73,490,500 construction versus MCr 73 list price. All stated physical values, both arms, skill equivalents and 74 freeBandwidth match; all 16 Slots are used. The component sum is not overridden to force the catalogue price.
- Sabmiqys (p 256): Cr 70,085,100 construction versus MCr 70. Four Size 5 arms, Armour 4,6 m,INT 15,60 Bandwidth and the tentative 288-hour endurance match, but the components use 17 of 16 Slots: superior body 8, additional arms 4, armour 1, brain 1, Bandwidth upgrade 1 and self-maintenance 2. Published skills remain unknown. No undocumented slot credit or anatomy conversion was invented.
- Ultra (p 258) remains an unretained reconstruction candidate: its listed solar coating and visual camouflage conflict with the general coating incompatibility rule. Its text describes changing modes, but a general source-defined switchable-coating construction rule has not been established.

These two retained fixtures are in published-high-technology-fixtures.mjs and source-expansion-audit.test.mjs. They are numeric source reconstructions, not redistributed source pages.
