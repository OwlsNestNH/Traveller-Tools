# Combat checkbox coverage

All native checkbox inputs receive `switches.css`, loaded after the existing combat styles. Input type, IDs, names, labels, checked values, disabled state, events and form transactions are unchanged. Radios and selects are excluded; Basic systems retains Off / 50% / Full.

| Producer | Checkbox presentations |
| --- | --- |
| index.html | Hex grid; selected ranges |
| add-screen.mjs | Sandcaster defense; detailed crew station assignments |
| editor.mjs | Explicitly unarmed (new and loaded design); crew station assignments; synthetic movement capability; no recorded criticals |
| ship-sheet.mjs | Detailed crew station assignments |
| systems-editor.mjs | Drive; sensors; jump reservation; source-load allocations; additional installed equipment allocations; other manual draw; inventory confirmation |
| station-pane.mjs | Engineer operating switches for recorded systems and loads, including weapons |

`switches-browser.mjs` inventories computed styles in each editor at 1876, 1440, 1100, 390 and 320 pixels, checks native Space/Tab, label activation, touch, checked knob position and draft cancellation. Existing full browser regressions cover commit/cancel, failed-save retry, disabled locks, save/reopen and ship isolation. Forced-colors mode restores native checkbox appearance.

Before/after PNG pairs disable only the new stylesheet for the baseline, using the same page, ship and values. The separately captured pre-change Engineer screenshots are retained locally. No live user storage is used.
