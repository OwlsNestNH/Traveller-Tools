# Vehicle Handbook Update 2026 integration audit

The local 1 April 2026 PDF was inspected privately. Its front matter identifies Vehicle Handbook Update 2026. Printed pages 74, 75 and 77 were rendered and read visually, including the cross-page decoy text and the table column headings. Robot Handbook p62 supplies the conversion and precedence rule; the complete 2022 Handbook text and existing construction catalogue were searched for corresponding options. No matching construction equivalent was identified for the three dischargers. Source files, page images and extracted prose remain outside the repository.

## Implemented boundary

- Immutable source-ID selection for decoy, prismatic aerosol and smoke hardware, with source pages/edition in the catalogue, evaluated records and review.
- Individual fixed-Space conversion, quantity totals, source TL gates, ordinary combined Slot capacity and legacy import defaults.
- Deployment conditions retained as structured facts and short labels. No unconditional defence, skill or armour grant.
- Capacity distinct from contents, purchases and operating readiness. Initial contents are unspecified. Additional-charge procurement has unknown price and mass and therefore blocks a complete total.
- Separate user-entered external estimates remain unverified. Known Robot Handbook alternatives, zero-Space exclusions and qualified percentage conversion stay on their existing path.

## Remaining bounded groups

The wider 2026 options chapters are available. Other fixed-Space utility/sensor rows need individual equivalence and compatibility checks before admission. Habitat, workshop and other room-like options also need their occupant scaling, interfaces and fit rules carried through; many exceed ordinary robot capacity. Lack of fit is not a universal prohibition. Percentage and vehicle-hull-dependent options, prototype variants and vehicle/ship host legality are not included in this subset. The earlier Vehicle Handbook is not a gate or required comparison.

## Verification

`verified-vehicle-source.test.mjs` anchors exact source facts, conversion, quantity/fit/TL limits, immutable-source rejection, unknown charges, detached output, import/export, API saving and review. Existing generic external-option regressions remain required. `vehicle-options-browser.mjs` covers editing, repeated additions/removal, unknown-charge blocking, TL repair, navigation, persistence, rejected forged imports and 1440/390/320 pixel layouts. It runs in the Robot Builder CI workflow alongside the existing broad browser suites.

Complete component snapshots retain detached vehicle-option records and source diagnostics. Review and statblocks show source hardware per component copy, including invalid or blocked children, while brain-only purchases omit this hardware and its purchase/deployment warnings. Installation quantity and component-copy quantity remain separate; no host benefits or duplicated costs are added. `vehicle-options-composite.test.mjs` covers these boundaries and mutation isolation, and the CI browser journey includes component review, quantity, invalid-child and brain-only checks.

## Six fixed-Space utility choices

Private pixel review covered printed VH57 and VH68-69. The full Robot Handbook and current construction catalogue were checked semantically alongside the independent audit. Status: **No matching construction equivalent identified; related RH paths reviewed.** Forklift (RH52) and manipulators (RH25-28), scientific toolkit (RH59), Planetology (RH58), bioscanner/densitometer (RH57) and atmospheric/olfactory sensors are related alternatives or complements, not demonstrated construction equivalents. No copied source prose or scans are included.

- Light Crane: source hardware TL1, 1 Space / 64 Slots, Cr1,000, 500kg individual maximum load, VH68.
- External Sampler: Basic TL8, 3 Spaces / 192 Slots, Cr10,000; Improved TL10, 1 Space / 64 Slots, Cr15,000; VH69. One selected medium per installation. Advanced zero-Space sampler excluded from direct import under RH62.
- Ground Penetrating Radar: Basic TL7, 2 Spaces / 128 Slots, Cr20,000, nominal 100m; Improved TL9, 1 Space / 64 Slots, Cr50,000, nominal 200m; Advanced TL11, 1 Space / 64 Slots, Cr100,000, nominal 500m; VH69. Advanced detection DM+2 and three dedicated grav drones remain per-installation conditional facts.

Hardware TL is fixed to the selected source configuration, not upgraded by the host robot TL. The crane's hardware-TL5 power predicate is not triggered by a TL15 host. Higher-hardware-TL load scaling/price interpretation, prototypes and miniaturisation remain deferred. VH57's standard stage progression applies only to computers/transceivers, not these utilities. Larger cranes, cutting tools and drill rigs are source-verified but outside this ordinary-body subset because of current fit, not declared universally illegal.

Operation remains conditional: crane reach and clearance; sampler power, one medium, appropriate skill check and adjacent laboratory for isolated delivery; radar power, Average8+ Electronics(sensors), INT/EDU and 1D rounds. Radar's solid-rock/metal reduction is a maximum 75% effectiveness reduction, not a fixed depth multiplier. Crystaliron, superdense and more advanced armour block penetration. Neither drones nor device quantities grant general skills, stacking bonuses, manipulators or attacks. Power context supports existing robot sources and direct connection, leaves source/output uncertainty visible, and never creates a numerical energy budget.

Exact capacity regressions establish 64 remaining Slots for Size7 wheeled and 128 for Size8 wheeled. Size8 stationary, no base arms, No Internal Power, direct connection at TL8 has 199 remaining; the Basic Sampler fits with 7 remaining. Direct connection needs no separate TL9 External Power installation. Adding that option at TL9 leaves exactly 192, fitting the same sampler. These construction results do not certify physical reach, clearance or autonomy.

`vehicle-utilities.test.mjs` covers immutable source facts, capacity/TL checks, isolated media, quantity accounting, conditional power/detection, API/JSON defaults, invalid-field retention/repair, complete components, copy quantities, brain-only omission, cybernetic body context and detached projections. `vehicle-utilities-browser.mjs` adds editor repair/switching, save/reload, forged import rejection, exact sampler fixtures, selected-source review, responsive/print layouts and component boundaries; it runs in the Robot Builder CI workflow. Existing discharger and generic external-option regressions remain required.
