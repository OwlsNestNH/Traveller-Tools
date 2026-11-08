# Vehicle Handbook Update 2026 integration audit

The local 1 April 2026 PDF was inspected privately. Its front matter identifies Vehicle Handbook Update 2026. Printed pages 74, 75 and 77 were rendered and read visually, including the cross-page decoy text and the table column headings. Robot Handbook p62 supplies the conversion and precedence rule; the complete 2022 Handbook text and existing construction catalogue were searched for corresponding options. The three dischargers have no corresponding Handbook construction row. Source files, page images and extracted prose remain outside the repository.

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
