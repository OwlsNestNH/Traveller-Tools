# Traveller Vehicle Builder

Published at [Traveller Tools](https://owlsnestnh.github.io/Traveller-Tools/tools/vehicle-builder/). This folder contains the current standalone builder, editable source, tests and summary audit reports. Previous copies and nested archives are excluded.

Open **Traveller-Vehicle-Builder.html** in your browser. It works offline; no installation or account is required. Reload an already-open copy to receive the update. Saved browser drafts remain separate from the installed app.

Open **CATALOGUE-AUDIT.html** for historical summary findings. The 99 catalogue test designs and detailed vehicle data have been removed from the current publication.

This release includes Hull and Structure, system-family dropdowns, towing and life support, encrypted/tightbeam/uplink radios, sensor modifications, manipulator customisation, prototype computers/radios, multiple control stations, empty weapon mounts and a printable vehicle sheet. Source tables include book and printed-page references. Biological options are excluded.

## Catalogue results

The historical aggregate results are retained in [CATALOGUE-AUDIT.md](CATALOGUE-AUDIT.md) and [HULL-STRUCTURE-AUDIT.md](HULL-STRUCTURE-AUDIT.md). These reports contain counts and limitations, not vehicle specifications or downloadable designs. They cannot be rerun without the removed fixtures.

## Verification

### Mixed passenger seating

In **Crew & cargo**, keep the driver under Crew. Set the main passenger group, then use **Add passenger group** for seats with a different Space allocation. Groups have a label, passenger count and Spaces per person. For one driver and three main passengers at 1 Space each, plus two fold-down passengers at 0.5 each, accommodation uses 5 Spaces for 6 people. Fold-down seats reserve their occupied space; folding them does not automatically add cargo capacity. Each group's installed Space total rounds up separately, following the existing accommodation convention.

The screen and printable record show overall Comfort and the equipment contribution. Seat comfort labels continue to describe seating allocation; equipment contributes to the shared overall value. Passenger groups count toward life-support checks. Old version 1 designs still load; exports containing additional groups use version 2 to prevent older builders silently dropping the extra seats. Browser saves retain the groups.

Run `node seating-tests.cjs` from `source/` for mixed seating, rounding, size multiplier, entertainment stacking, life-support totals, legacy compatibility and invalid-group checks. Browser checks also covered group editing/removal, saved-design round trips, printed-record contents, invalid-import preservation, and mobile layout.

The supplied release reports 464 equipment and 160 weapon reference rows checked against its original worksheet, and a coverage ledger of 1,885 rows. These historical source checks were not repeated during website publication; source books and the worksheet are not included.

Website publication checks (2026-10-03): 103 construction checks, 11 additional mechanics checks and 17 Appendix I checks passed. Historical checks also exercised the 99 catalogue fixtures before their removal. Current render and Hull/Structure tests use the remaining non-catalogue fixtures. Browser smoke checks passed for all 11 sections, local save/restore, JSON export/import, source references and both audit pages. Desktop and 390-pixel mobile layouts were inspected. These checks verify application behavior, not independent verification of every rule or catalogue reconstruction.

`component-coverage.csv`, `catalogue-summary.csv` and `hull-structure-summary.csv` retain aggregate counts only. `source/` contains the application and executable tests. Run tests from that directory with Node; rebuilding the standalone file also requires Python. The source books and workbook are not included.
