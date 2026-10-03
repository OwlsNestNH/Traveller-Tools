# Traveller Vehicle Forge

A dependency-free HTML vehicle construction workbench. Open `dist/index.html` in a browser, or use the standalone `Traveller-Vehicle-Builder.html` in the parent directory. No account or server is required for the local file.

## Sources

- **Traveller — The Vehicle Handbook Update 2026**, supplied PDF dated 01-04-2026. Printed pages 24–105 govern the implemented core construction rules; equipment and weapons refer to their own book sections. PDF page = printed page + 1.
- **VehicleDesignWorksheet-v056Blank.xlsx**, version 0.56. Numeric data is extracted from the original named tables. Cell references accompany catalog entries. The workbook is read, never modified.

The handbook controls disagreements. The in-app **Book & worksheet sources** audit documents corrections and explicit choices where the handbook itself conflicts. Verification uses construction rules, arithmetic and invalid-state tests. Appendix I provides a comparison without forcing the engine to reproduce book discrepancies. The 99 catalogue test designs and detailed vehicle data have been removed; only historical aggregate findings remain. Mechanical coverage governs success; pricing is informational.

## Included

- Ten chassis categories and TL0–20 data; size modifiers and the base-cost floor.
- Feature eligibility, prerequisites and conflicts; additive prices; speed caps and AFV/Tracks interaction.
- Primary/secondary power, nuclear plant minimums and output, alternate-power capacity changes, speed/efficiency/fuel changes, auxiliary drives, airship gases and submarine depth.
- Whole-Space accounting, fractional armour costing, six-face transfers and hull changes.
- Separate Core systems, External options, Internal options, and Computers & automation sections; one dropdown per system family with notes, explicit quantity units and book/page references.
- Radio encryption, tightbeam and satellite uplink; sensor customisations; fibre-optic computers; bays, life support, towing fittings, restored landing-deck grades and luxury exteriors.
- Weapon mass limits, mounts, linked weapons, crew, fire control, loaders, pop-up mounts and ammunition storage.
- Hull and Structure shown separately; only available construction features are offered. Invalid existing selections remain removable.
- Crew/cargo allocation, live ledger, explicitly invalid drafts, JSON save/load, optional browser save and a printable vehicle sheet.
- Assigned loaders, gun shields, self-contained anti-missile mounts, external fuel tanks and reserve-ammunition profiles (compatibility remains flagged for review).

## Explicit limits

This is a conventional **new-construction** builder, not complete automation of every optional rule in the book. Biotech, post-construction modifications, bespoke robot brains and general prototype development beyond computer/radio stages, orbital flight planning and combat resolution are not automated. Specialist workbook-only equipment is budgeted but carries a review flag. Some combinations (including alternate-power airships and program assignment across several computers) also require review. Review-required and invalid drafts are never labelled as fully checked. These limits are visible in the app.

Book section references and worksheet extraction are distinct: a section citation does not imply every catalog number has been individually reconciled against the PDF. Entries without a verified book locator say so. The source PDFs and workbook are not distributed in the site.

`EQUIPMENT-AUDIT.md` accounts for all 464 worksheet option rows and 160 weapon rows, including omitted headings, placeholders, biological items and incomplete custom specifications. It also records handbook coverage through printed p130. Weapon ammo profiles budget purchased reserves; combined ammo modifiers and combat damage resolution are not automated.

## Verification

`node tests.cjs` runs the core rule suite and writes `verification.json`. Tests cover rule boundaries and independent expected calculations; all ten chassis are also exercised at 21 TLs and five size boundaries for finite results.

Earlier manual browser checks covered live updating, equipment search and addition, invalid-state feedback, navigation, source captions and responsive layout. Earlier WebMCP loading and inspection were exercised, including a malformed import that leaves the current draft unchanged.

`node appendix-tests.cjs` runs 17 Appendix I checks. `APPENDIX-I-TEST.md` records matching results and discrepancies between the example and explicit rules. `appendix-i-design.json` is an importable comparison fixture. `python verify_workbook.py` verifies the 624 reference-table rows against the original workbook without writing it. Run `node audit.cjs` before `python package_standalone.py` when rebuilding.

## Files

- `dist/data.js`: extracted reference tables and source locators.
- `dist/engine.js`: pure construction calculations and checks.
- `dist/app.js`: interface, import validation and optional WebMCP controls.
- `dist/ui-model.js`: equipment grouping, search aliases and presentation filtering.
- `dist/audit-data.js`: generated, row-by-row equipment coverage audit.
- `dist/style.css`, `dist/index.html`: responsive interface and printing.

Independent fan tool for use with the user's supplied Traveller books. Traveller and the source material belong to their respective rights holders.

## Historical catalogue testing

The 99 catalogue test designs and detailed vehicle data have been removed from the current publication. The parent folder retains summary audit reports and aggregate CSV counts. These historical results cannot be rerun from the published files.

Run `node mechanics-tests.cjs`, `node render-tests.cjs` and `node hull-structure-tests.cjs` for the remaining mechanics, interface and Hull/Structure checks. No current suite depends on the removed catalogue fixtures.
