# Career presentation pilot

Army is the single ordinary Imperial career pilot. Human characters use the new presentation; other careers and species retain their existing presentation. No engine data, session revision, saved event, qualification, training choice, rank award, event, mishap, benefit or eligibility rule changes.

The catalog projects rank titles and reward-reference labels from the existing frozen source pack; the GUI never imports engine modules in HTTP mode. The template reads that presentation grid; it never renders the whole grid or grants an award. Only the current title and rank reference appear. Specialty controls and summaries iterate projected assignments, supporting two, three, four or other counts without column assumptions. Genuine career exceptions belong in separate typed adapters, not placeholder specialties or invented generic rules. The empty exceptions registry does not authorize an exception.

The presentation keeps the existing live controls and their handlers in place. Journey labels are status, not navigation links: earlier accepted rolls cannot be repeated by clicking a phase. Existing Back, Cancel, required-choice focus, confirmed GM rewind, technical recovery and saved-history procedures remain authoritative. Crow guidance yields to an actionable required-choice warning and returns on dismissal. Optional informational copy remains distinct from essential choices and errors, for the separately planned guidance preference; no preference is implemented here.

Outcome comments use the existing domain-separated action-id hash and a separate text bank. They consume no rules RNG and add no saved fields. A margin of six on a validated successful check selects the cosmetic exceptional-success bank; it adds no award or other mechanical effect. Survival failures remain fictional results, never technical error popups. Unknown, mixed, restored or replayed checks do not manufacture success. Technical error art remains default Crow.

## Source verification

Checked against the available Core Rulebook Update 2022, printed pp. 24–25 (Army): entry, specialty checks, skills/training, enlisted and officer ranks/rewards, events/mishaps and mustering-out benefits match the existing source-referenced pack. Current choices are still projected by the engine, including EDU-gated and commissioned-only training. General training and term procedures retain their existing Core p.18 references. No full book table or private source locator is added to the UI or this document.

An ordinary Army career represents ground forces and can include mercenary service; this pilot does not invent Imperial citizenship, patronage, or eligibility requirements. Other source-assisted consequences retain explicit referee boundaries. No missing rule has been filled with guessed mechanics.

## Review

`career-template.test.mjs` checks the source-backed grid, current titles, two/three/four specialties, scope, stable six-variant comments, and outcome classification. `army-pilot-browser.mjs` exercises static/HTTP desktop/mobile application, Back without mutation, initial skill decisions, survival, event decisions, progression, benefits, repeated clicks and interrupted reloads. Existing career separation, awards, benefits, recovery and source regressions remain required. The focused CI job publishes only synthetic screenshot fixtures. Merge/deploy requires owner visual approval, exact-head checks and independent review.

All three specialties (Support, Infantry and Cavalry) are included in the career template. Native engine regression covers each specialty's entry/basic training, assignment-table training, enlisted rank reward, commission reward, cash benefits and import replay. Browser review runs each specialty end to end over static/HTTP at desktop/mobile widths. Recorded Army dice reuse the approved education pip renderer and gold color; decorative faces never roll or modify results.
