# GUI control-parity checklist

**Status: preparation only. The future GUI described here is not implemented or browser-verified by this document.** The baseline already contains the listed controls; every unchecked item means their future placement and behavior still need verification, not that the baseline feature is missing.

Baseline: PR #9 merge, [`ee77f6d7a95928bb02da59cf76faf73ebbc35b56`](https://github.com/OwlsNestNH/Traveller-Tools/tree/ee77f6d7a95928bb02da59cf76faf73ebbc35b56/tools/trade-route-calculator). This checklist carries the pre-GUI control and architecture review into the repository. It is the behavioral companion to the visual mockups, not a request to implement the GUI during preparation. [REQUIREMENTS.md](REQUIREMENTS.md), [ARCHITECTURE.md](ARCHITECTURE.md) and the existing handlers remain the behavior specification.

## Scope and use

- Future homes below are compact, reachable destinations for existing controls. A menu, disclosure or contextual dialog may replace a prominent button; no baseline action may disappear merely because a mockup omitted it.
- The future shell has Overview, Trade, Cargo, Contracts, Accounts, History and Settings views, with Ship expenses in the Overview action strip. Creating the Trade view relocates existing trade workflows; it does not introduce a new trading engine.
- No new broker-lock/reset rules, editable refill-target semantics, mortgage or maintenance features, Trade “Add commodity” action, Wiki links or generated-world links are included. Existing broker selection remains per search; fuel specifies tons to acquire; life support refills missing stock to capacity. Existing published-data/source links and attribution remain available.
- Keep current behavior until each GUI slice is separately implemented and verified. Mark an item complete only with evidence for its actual new home, including its disabled, read-only, error and cancellation states. Record the tested commit and relevant tests/screenshots in the implementing change.

## Shared shell and Overview

- [ ] **Six views, Ship expenses beside tabs** → Seven folder tabs: Overview, Trade, Cargo, Contracts, Accounts, History, Settings; Ship expenses in the Overview top action strip. Tab switching stays read-only. The new Trade view must be wired into successful supplier/buyer searches and sale continuation paths.
- [ ] **Save status, editing/read-only status, Take over editing** → Small persistent header status and takeover action. Do not hide storage failures or allow mutations while another tab owns editing.
- [ ] **Bank, actual location, ship name, hold usage** → Shared status strip. “Current world” must mean ship actual location, independently of the world being browsed.
- [ ] **Campaign Imperial date/time, −1 day, +1 day** → Shared status strip or Overview clock group; full correction in Settings. +1 day consumes supplies; −1 day corrects the date without restoring supplies or reversing transactions and cannot precede campaign start. Neither is Undo. Both retain their history, save and editing-lock behavior; Undo restores date and supplies together.
- [ ] **Fuel stock/capacity, life-support stock/capacity, empty warnings** → Green status bars with text values in header; refill actions in top strip. Retain unconfigured and zero/empty states and accessible progress labels. Color alone is insufficient. No duplicate current-life-support readout.
- [ ] **Fuel source Refined / Unrefined / Collect water** → Refined and Unrefined in top strip; Collect water in the refuel dialog/source selector. Keep free water collection and other-supplier/referee-confirmed source paths reachable. Selecting a source is not a payment.
- [ ] **Refuel, Fuel for next jump, Fill tank, editable acquisition tons** → Refuel opens existing fuel-only preview; quantity shortcuts remain inside. The editable quantity means tons to acquire, not desired final stock. Retain availability warnings, tank/bladder capacity, notes, cost and explicit payment review.
- [ ] **Refill life support** → Overview top action. Fill missing stock to configured capacity using the existing preview and confirmation. Preserve supply-availability confirmation, whole-day and partial-day handling, cost and Undo; no new target-stock input.
- [ ] **Ship settings shortcut beside support** → Settings → Ship & accommodation, with a shortcut from unconfigured resource status. Keep ship configuration reachable; unconfigured refuelling must still open its setup flow.
- [ ] **Hold breakdown: owned goods, freight/mail, passenger luggage, fuel in bladders** → Cargo occupancy, with an optional header disclosure. Retain all four components. Used/free totals must reconcile with the shared header.
- [ ] **View freight/mail shortcut from hold** → Header hold disclosure or Cargo occupancy → Contracts. Keep this shortcut or an equivalent direct link; distinguish reserved cargo from owned lots.
- [ ] **Rules & Notes; footer source/verification/project credits** → Settings Backup & Data, small header/footer access. Retain Rules & Notes, source/verification links and attribution.
- [ ] **Initial setup, Load campaign** → Welcome/empty campaign state outside normal tabs. Retain opening balance/date/current world/fuel/accommodation setup.
- [ ] **Corrupt-save recovery: raw export, import, reset, error reason** → Recovery state outside normal tabs. Keep original broken data until deliberate replacement; do not fall through to a fresh campaign silently.

## Map, worlds and routes

- [ ] **Find world** → Overview toolbar. Preserve Recent worlds and searchable Sector → Subsector → World, automatic hex, loading/error/retry and dependent-selection reset.
- [ ] **Plot route by name** → Route dropdown → Plot by name. Preserve mandatory stops, Add stop, Move up/down, Remove stop, destination picker, Calculate, Review, Save.
- [ ] **Auto plot from map** → Route dropdown → Auto plot. Preserve destination click behavior, progress/error states and saved-route preview.
- [ ] **Build exact route from world/empty-hex clicks** → Route dropdown → Build manually. Preserve exact ordering and direct-leg validation. Keep empty-space selection available when hiding the visible Show hexes toggle; hexes remain enabled.
- [ ] **Clear planned route** → Route dropdown → Clear planned route. Clears plan from actual world only, never moves ship or resets campaign. Keep explicit review and Undo.
- [ ] **Active planning: Save planned route, Remove stop, Remove last, Retry route, Cancel planning, mode/instructions** → Compact contextual planning tray below route toolbar/chips. Dropdown launch controls alone cannot finish or correct a plan. Retain loading/invalid disabled states.
- [ ] **Refresh nearby** → Overview toolbar refresh control. Give it the accessible name “Refresh nearby” and preserve visible loading/failure/retry status.
- [ ] **Current system** → Overview toolbar. Browses actual ship world and recenters there; distinct from resetting zoom and from relocating ship.
- [ ] **Zoom − / + / Reset view, percentage, world/subsector/sector level** → Overview right toolbar. “Reset view” is clearer than bare “Reset.” Preserve 6–240% range and existing 20%/16% layer thresholds.
- [ ] **Show UWP / Political territory** → Overview visible toggles. Preserve UWP behavior at maximum zoom and the persistent territory preference, which is separate from campaign saves.
- [ ] **Show hexes** → Always-enabled map hexes; no visible toggle in the future shell. The future change hides only the toggle. Preserve hex drawing/labels and empty-hex selection, and update help text that tells users to turn the toggle on. The current GUI remains unchanged during preparation.
- [ ] **Drag/pan, wheel zoom, keyboard world/empty-hex activation, live nearby loading** → Taller map canvas. Preserve all existing gestures and hit testing. Wheel outside map and Ctrl+wheel remain normal browser behavior.
- [ ] **Clickable planned-route stops, current/done state** → Responsive wrapping route chips above map. Twelve chips or a 6+6 arrangement are examples, not route limits. Maintain ordered stops and active/completed distinctions.
- [ ] **Previous, Next** → Compact route-navigation row next to/below chips. Browsing controls only; do not advance ship/time.
- [ ] **COMMIT JUMP → next world** → Primary route action beside route-navigation row. Preserve dice/hours/referee override, fuel shortage warning, life-support effects and explicit commit.
- [ ] **Viewed world identity, sector/hex, UWP, travel-zone badge, trade codes, fuel availability** → World strip below map. Preserve zone/incomplete-data/empty-space warnings and distinguish published planet data from overrides.
- [ ] **Planet information and retry/source link** → World strip → Planet information dialog. Keep detailed UWP/system/remarks sections, retry and the existing read-only published source link. Do not add new external world links.
- [ ] **World override** → World strip. Preserve effective UWP, travel zone, fuel availability override, accessible water and required reason.
- [ ] **Use as starting world / Set ship location** → Find world dialog and viewed-world secondary action. Preserve explicit reason/confirmation and effects: clear route, no travel/time/bank change, insurance amendment warning.
- [ ] **Fuel alerts, map loading failures, instructions** → Compact contextual notices near route/map. Missing/unshaded data cannot imply confirmed fuel or unclaimed political territory.

## Trade and Cargo

- [ ] **Find supplier / Find buyer** → Trade top toolbar. Preserve local/actual-world guard and empty-space restrictions. Successful buyer search currently routes into Cargo; adapt it so the new Trade workflow remains coherent.
- [ ] **Search identity, method (Broker / Streetwise black market / online Admin), physical dice, duration, characteristic, counterparty, local skill, referee success** → Search dialogs. Search commits time; simply opening/cancelling does not. Keep repeat-attempt and rejected-counterparty cooldown notices.
- [ ] **Local broker/fixer choice currently per search and saved with each snapshot** → Trade search dialogs; any compact Crew/Local selector invokes the same existing choice. Retain per-search choice and snapshot audit. Use “Crew” rather than “Party” for the visual label; no planet lock, automatic reset or new persistence rule.
- [ ] **Saved market-search selector** → Trade available-goods header or More → Market history. Existing supplier offers remain inspectable. Distinguish selected supplier/world/time/legal-vs-black-market.
- [ ] **Commodity search and Active/All/Expired/Illegal filters** → Trade goods toolbar / compact filter menu. Preserve filter counts, illegal/referee-required tags and expired-offer states.
- [ ] **Per-offer expiry/reactivation checkbox, Expire all** → Row More / Trade More. Keep explicit expiry/reactivation; navigation alone must not expire offers.
- [ ] **Reject supplier’s deal / reject buyer offer** → Trade More or counterparty menu / sale dialog. Preserve explicit 30-day restriction, separate from Cancel.
- [ ] **Availability audit** → Available goods section header. Keep saved quantities/draws and availability reasons; opening does not reroll.
- [ ] **Buy / offer Audit** → Available-goods row. Buy still opens partial-quantity/fee/insurance preview, never buys whole row immediately.
- [ ] **Referee offer Edit** → Row More or clearly separated override action inside offer details. Preserve remaining quantity, direct price or pricing-roll recalculation, notes, description, illegal status, required reason and earlier audits. Do not edit completed transactions.
- [ ] **Recorded Roll / Trade DM / Modified / % / Normal / Actual / total / notes columns** → Trade purchase/sale ledgers exposing recorded values. Display recorded rolls, not a new reroll action. If Modified = Roll + DM, Trade DM is the total signed pricing DM. Audit retains components, clamped lookup, raw/effective retail, limits, fees and overrides.
- [ ] **Current sale quotes vs purchase audit** → Trade sale rows vs Cargo purchase columns. Separate explicitly. Read frozen purchase/quote values, not current-settings retail recomputation. Manual/opening lots may have no roll/DM: display “Not recorded,” never invent zero or derive a roll.
- [ ] **Separate lots with same commodity** → Trade sale and Cargo rows. Use lot IDs throughout, never aggregate away separate basis/audits.
- [ ] **Select cargo / Select all / Clear / Get sale offers** → Compact multi-select controls on Trade sale table. Single-row Sell alone loses existing multi-lot sale workflow and changes transaction-level tax grouping.
- [ ] **Choose previous buyer / Find another buyer / Reject offer** → Sale workflow dialog. Preserve cached same-buyer prices until campaign changes.
- [ ] **Sale quantity, fee, per-lot price/benchmark/local ban, tax override/reason, Edit quantities/fees** → Sale preview/review dialogs. Gross table totals are before broker fee/tax/profit adjustments, and must not imply final bank proceeds.
- [ ] **Cargo search, Name/Quantity sort** → Cargo toolbar. Retain both Name and Quantity sort, search and filtered/total counts.
- [ ] **Add existing / referee cargo** → Cargo → Add existing cargo. Adds owned cargo without debit; preserve commodity/description/quantity/actual cost/goods-only value/illegal flag/reason.
- [ ] **Cargo Edit** → Cargo row. Current action is an audited correction of remaining quantity, description, cost basis, goods value and reason, not merely a freeform notes edit.
- [ ] **Cargo Sell / Audit** → Sell in Trade; Audit in both Trade and Cargo. A clear “Trade this lot” link may replace duplicate Cargo Sell, but must select the correct lot and keep the existing sale flow reachable.
- [ ] **Insure existing cargo** → Cargo row More / lot detail action. Retain insurance-at-purchase as well.
- [ ] **Active policies: Policy audit / Loss-claim / Amend-close** → Cargo expandable Insurance section; any Contracts duplicate links here. Preserve status, route/destination, partial quantity, referee approval, premium adjustment and coverage-ended/amendment-required behavior.
- [ ] **Closed insurance policies** → History archive section. Must remain auditable even when insurance display is disabled.
- [ ] **Hold occupancy** → Cargo bottom section. Include fuel in bladders alongside owned goods, accepted freight/mail and passenger luggage. Reconcile exactly with header used/free space.

## Contracts, Mail, Accounts and History

- [ ] **Find contracts generates freight AND mail** → Contracts → Find freight & mail. Preserve existing dual generation and its inputs; a shorter visual label must not change which offers are generated.
- [ ] **Destination, search dice/skill/characteristic, editable freight deadline, dice-sequence overrides** → Find freight & mail dialog. Retain all inputs. Deadline is referee-agreed input, not a fixed automatic rule.
- [ ] **Check for mail with auto/manual availability and container rolls** → Contracts toolbar → dialog. Keep current Settings shortcut and DM preview.
- [ ] **Collapsed Mail card, saved disclosure state, current/latest check** → Contracts Mail card. Start collapsed after reload and retain disclosure choice within the session. Only the latest check appears here; old checks stay in History. Distinguish actionable session offer from read-only restored audit; preserve independent inner shipment disclosure.
- [ ] **Mail accept-whole, does-not-fit/return-origin states, Audit, edit before acceptance** → Expanded current Mail offer. Preserve whole-consignment acceptance, capacity/origin checks, saved visible rolls, Audit, How was this calculated?, editing and Settings access.
- [ ] **Cancel mail before first committed jump** → Expanded accepted Mail / accepted-shipment row. Preserve explicit cancellation, no payment/penalty, reserved-space release, immutable audit and Undo restoration. No cancellation after departure.
- [ ] **Manual freight/mail contract** → Contracts top action. Preserve kind, destination, tons, payment, freight due date and reason; existing form accepts directly.
- [ ] **Available freight Accept / Audit / Edit** → Available freight table, with compact row More if needed. Keep all three actions, whole-lot acceptance and pre-acceptance audited corrections.
- [ ] **Accepted Deliver / Audit and eligible mail cancellation** → Accepted shipments table and shipment details. Provide the active-state controls as well as delivered rows. Arrival alone does not pay; explicit delivery pays only once.
- [ ] **Late freight penalty die/referee terms** → Delivery confirmation. Preserve penalty-die and referee-term inputs; mail has no automatic late penalty.
- [ ] **Cancelled mail audit archive** → History. Required and currently implemented. Cancelled mail should not return to active Contracts list.
- [ ] **Record expense, Record deposit, Referee bank correction** → Accounts toolbar. Keep negative correction vs ordinary expense distinctions and reasons.
- [ ] **Ship expenses** → Overview top action; optional Accounts shortcut. Keep the existing expense flow clearly reachable from the shared shell even if the duplicate Accounts shortcut is removed.
- [ ] **Export TXT, Save JSON** → Accounts + Settings. Keep actual reports/backup download behavior.
- [ ] **Compact ledger, Details first inline, balances, notes, newest transaction order** → Accounts table. Preserve the PR #9 Details-first inline presentation, ledger-audit and linked event-audit action targets, zero-payment omission, carry-in reconciliation and accurate post-transaction balances.
- [ ] **Undo latest change** → History; optional global shortcut. Global latest action regardless of filter, never row-specific Undo. Identify latest action when useful; no false claim of undoing the displayed row.
- [ ] **All/Jumps/Searches/Trade/Expenses/Settings/Undo/Other filters with counts** → History toolbar. Preserve counts, read-only filter behavior and recorded audits, including superseded checks.
- [ ] **Closed policies and cancelled mail archive** → History below events. Retain both archives and their audit actions.

## Expenses, Settings and backup tools

- [ ] **Berthing roll/save, saved rate reused by starport class, weeks to pay** → Ship expenses → Berthing. Preserve weekly saved-rate behavior and zero-cost E/X cases. A future Port costs shortcut, if added as presentation work, opens this existing berthing-only flow rather than defining a new charge.
- [ ] **Roll & save starport rate** → Expanded Berthing section. Important existing behavior: this commits the rate immediately; later Cancel does not undo it. Keep that immediate-commit boundary explicit; changing it requires separately approved behavior.
- [ ] **Select all, individual expense checkboxes, per-kind periods, notes, estimate, confirmation** → Ship expenses dialog. Preserve berthing/fuel/stateroom/person support/salary, each ledger line, total bank validation and one Undo for the bundle.
- [ ] **Fuel next-jump/fill, zero-fuel skip, source override notes** → Expanded Fuel. Full tank must not block paying unrelated selected expenses.
- [ ] **Stateroom vs passenger/crew payments** → Their expanded sections. Preserve separate charges. These manual payments do NOT replenish tracked life support; avoid paying both a manual support entry and tracked refill for the same supplies.
- [ ] **Salaries remembered after payment** → Expanded Salaries. Months are manually chosen billing periods; no due-date schedule currently exists.
- [ ] **Campaign/ship names** → Settings Campaign identity. If section-specific save is introduced, it must not unintentionally overwrite unedited settings or reset partial-day stock.
- [ ] **Capacity, jump rating, displacement, base tank, bladder extra jumps, fuel aboard, scoops** → Settings → Ship & accommodation. Retain every field, blank/untracked fuel handling, initial-stock correction without bank charge, and derived capacity/hold preview.
- [ ] **Cabins low/middle/high; service/custom costs; combined middle/high people; luggage override; support capacity/remaining** → Settings Ship & accommodation. Retain every field and campaign-rule notes. Middle/high people include crew; do not reintroduce double-counted cabins or crew.
- [ ] **Broker/Streetwise/Admin/default EDU-SOC/rank/highest SOC; armed ship** → Settings Trader & mail modifiers (armed can remain Ship). Preserve all values and mail linkage.
- [ ] **RAW100 / Reduced75 / Custom profit%; independent price limits; min buy/max sell; retail cap; illegal RAW exception** → Settings Trade rules & pricing. Preserve distinct controls and disabled-state values. Future-price changes never rewrite completed calculations.
- [ ] **Optional taxes and insurance** → Settings Optional taxes & insurance. Turning off insurance hides active panels, not policy records. Closed policies remain in History.
- [ ] **Future credit rounding step; preview/apply existing-value rounding** → Settings Rounding & time. Preserve the existing-value preview/apply action separately from the new-entry rounding selector.
- [ ] **Starting date, total elapsed hours, required correction reason** → Settings Rounding & time. Retain full correction form in addition to ±1 day shortcut.
- [ ] **Dev Tools: validate, copy report, create debug link, export debug JSON, clear error log** → Settings → Backup & Data → Diagnostics/Dev Tools disclosure. Keep every baseline diagnostic action reachable. Browsing diagnostics does not mutate the campaign; clearing the diagnostic error log remains a separate explicit action.
- [ ] **Save/load campaign JSON, Export TXT, Rules & Notes, Reset campaign** → Settings Backup & Data. Preserve validated import, 20MB limit, replacement warning, export-current-backup shortcut and explicit backup/proceed acknowledgement.

## State and transaction guardrails

- [ ] Keep schema 1, the existing storage key, rules version and entity IDs. Preserve historical prices, quantities, audits, cost basis, tax/profit settings, insurance records, route progress and fuel/life-support balances; do not migrate or rewrite them for a view change.
- [ ] Keep rendering and browser/session state separate from campaign authority. Tab changes, filters, selections, map navigation and opening audits must not save a campaign action, generate dice, refresh offers or charge money. Recent-world and map preferences remain browser preferences, separate from exported campaign data.
- [ ] Route all existing mutations through the same command/Store/save path and single modal host. Preserve duplicate-submit and async-cancellation protection; cancelled or superseded work must not return later and commit.
- [ ] Preserve persisted action strings such as `Mail check`, `Contract search`, `Contract offer edited` and `Undo: …`; current reconstruction uses those exact labels. Visual caption changes must not silently become an event/schema migration.
- [ ] Specify numeric units/normalization and modal rounding/insurance/tax context explicitly rather than deriving behavior from rewritten English labels or titles. Retain existing input names/defaults and behavior while converting; labels, unit annotations and validation remain accessible.
- [ ] Preserve upward rounding for new final money/positive adjusted profit, saved rounding increments and new whole-ton entries. Preserve historical fractional quantities and the distinct downward proportional cost-basis allocation with its remaining-lot remainder. Never globally replace every “down” rounding rule.
- [ ] Retain read-only browsing, audits and exports during ownership loss. New mutation controls must fail closed without safe locks; takeover reloads the latest campaign. Open stale buy/sale/Mail/jump/expense confirmations must not commit.
- [ ] After reload, import, Undo, an external save or editing takeover, saved Mail results are display-only. None of those paths may recreate an actionable unaccepted offer. Accepted consignments remain independent; cancelled Mail remains auditable in History.
- [ ] Treat map viewport geometry as a coordinated change. The baseline logical viewport is 520×320; scaling it proportionally is distinct from showing more geography. Before changing the logical aspect ratio, agree the intended behavior and keep projection, clipping, hit targets and loaded viewport bounds aligned. Preserve all four zoom layers, pan/reset and the separate route-search bounds.

## Future GUI acceptance gate

These are **unexecuted future-GUI checks**. Passing baseline or preparation tests is not proof that the future layout preserves them.

### Behavior and campaign compatibility

- [ ] Compare persisted campaign/domain state before and after traversing every tab, sort/filter, map pan/zoom/current-system/reset, selection and audit; it must be unchanged apart from separate browser preferences. Cancelled previews must not mutate state. Explicit **Roll & save starport rate** is a separate real transaction, even if Ship expenses is later cancelled.
- [ ] Exercise all three route modes: Plot by name with ordered mandatory stops; map Auto plot; exact-order Build route with worlds and empty hexes. Verify add/reorder/remove/remove-last/retry/save/cancel/clear, cancelled requests and long routes. Keep Current system, Reset view, Set ship location, Clear planned route and COMMIT JUMP distinct.
- [ ] Exercise buy partial quantity, two separate same-commodity lots, multi-lot selling, cached same-buyer reopening, new buyer, referee overrides, reject/cooldown, expire/reactivate/Expire all and historical snapshot audits. Verify gross/net, fees, tax and per-lot profit remain unchanged and selected IDs stay correct after sorting/filtering.
- [ ] Exercise complete/cancel/back/reopen/double-submit for purchases, sales, deliveries and combined expenses. Each accepted confirmation must create exactly one intended transaction and retain the same atomic Undo behavior.
- [ ] Exercise fuel unconfigured/full/zero/shortfall, free water collection, explicit source override, bladder occupancy/release and zero-fuel multi-expense bundles. Exercise life-support full/empty/partial-day/changed-complement states, refill, day advance, backward date correction and Undo.
- [ ] Exercise Mail collapsed/expanded state, manual/automatic dice, check supersession including an unavailable result, whole-consignment acceptance, before-departure cancellation, first committed jump, return travel, Undo, reload, replacement import and takeover. Saved audits stay accessible and stale offers stay non-actionable; arrival alone never pays.
- [ ] Exercise insurance off/on, purchase insurance, insure existing cargo, policy audit, route amendment, partial loss/claim, close policy and closed-policy History. Preserve saved terms and historical fractional insured entitlement.
- [ ] Verify Accounts Details chooses the correct ledger/event audit and transaction order remains commit order after time correction. History filters/counts stay read-only and never change the global latest Undo target.
- [ ] Exercise ownership handoff with every committing dialog open, no-Web-Locks/read-only behavior, save failures and corrupt-save recovery. Verify Cancel and failed validation leave current data intact; raw broken-save export remains available.
- [ ] Compare actual downloaded JSON before and after the refit using an older valid schema-1 fixture and a populated PR #9 Mail-lifecycle fixture. Exercise reload, valid/invalid/oversize import, replacement/backup acknowledgement, reset cancellation, setup and legacy missing fields. Re-import may change the local revision; domain records and historical values must remain equivalent. Verify TXT/JSON downloads and all Dev Tools actions.

### Responsive layout, keyboard and accessibility

- [ ] Inspect 1440×1000 and 1280×800 desktop, 768×1024 tablet, 390×844 phone, 320px width, landscape phone and 200% browser zoom. Folder tabs and top resource controls wrap without page-wide overflow; the map must not hide operational controls.
- [ ] Check route chips with 0, 1, 2, 12 and 30+ stops and long names. Preserve order, active/completed meaning and reachable actions; no fixed twelve-stop cap.
- [ ] Give each wide table its own labeled scrolling region; keep amounts, row actions and headers legible, with a discoverable touch-scroll affordance. Check long names/notes, large balances, legacy fractional values, empty states and missing recorded rolls/DMs; do not invent zeroes or allow unsafe text rendering.
- [ ] Verify hold = owned goods + accepted freight/mail + luggage + fuel in bladders after buy/fill/consume/deliver/claim/correction. Header and Cargo figures must match. Changing Settings must not reprice frozen offers or purchase audits.
- [ ] Make tabs, Route menu, disclosures, checkboxes, map/world/empty-hex choices and row actions keyboard-operable with visible focus and correct accessible names/state. Prefer native controls; any custom tab/menu role needs its full keyboard interaction model. Hidden panels must not retain focusable controls.
- [ ] Verify modal title, initial focus, focus trap, Escape/X/Cancel, long-dialog scrolling, reachable confirmation and return focus. Route-menu Escape also returns focus. Preserve search caret and meaningful focus across typing, selection, disclosure toggles and rerenders.
- [ ] Preserve touch drag without accidental world activation; do not trap ordinary page scrolling, browser pinch/zoom or Ctrl+wheel. Keep keyboard alternatives for essential map actions.
- [ ] Provide textual stock/capacity and accessible progress labels. Empty/low/disabled/selected states must be clear without color, including high contrast and reduced motion. Icon-only actions need names; repeated row actions need row context; tables need proper header associations.
- [ ] Announce loading, validation, stale previews, storage errors, insufficient funds, stock warnings and completed actions with appropriate status/alert behavior, without duplicate announcements.

### Evidence and release boundary

- [ ] Run all native suites, all rules-data checks and the seven trusted Chromium suites: main application, modal lifecycle, click routing, fuel, empty space, Mail and map overview. Add a focused GUI-parity browser gate and update moved-control selectors while preserving behavior assertions.
- [ ] Review historical browser scripts before promoting them into CI. `verification/ledger-layout.test.mjs` and `verification/jump-ledger.test.mjs` contain obsolete assumptions about a bank ledger in History; do not restore that old UI merely to satisfy them. Accounts holds financial rows; History holds events. Adapt source-shape/VM tests if rendering is extracted rather than deleting coverage or calling it browser verification.
- [ ] Record passed, failed and not-run checks for the exact final implementation commit, with responsive screenshots and fixture/export comparisons. Do not mark this checklist complete or the GUI ready for release from preparation-only results.

## Stage 1 implementation scope

The shared status strip and seven-view navigation, Overview-only services/day controls, map-first Overview, Route disclosure, wrapped route chips, original jump/browse controls and compact audited cargo summary are implemented in this slice. The old market and sale panels are reachable in the real Trade view; Cargo and all secondary view content retain their existing workflows.

Geometry is a shared measured descriptor: 440 logical vertical pixels, about 8.8 hex rows at 100%, and width matched to the displayed aspect ratio. Area fetches, culling, projections, clipping and pointer transforms follow it. The original 520×320 descriptor remains the non-Overview module baseline.

Verification for this slice adds the GUI-parity browser job (synthetic campaigns only), alongside all seven existing Chromium jobs. It covers tab/filter/audit byte stability, compact audit missingness, 12/30-stop wrapping, desktop/tablet/narrow/landscape viewports, keyboard route/world/empty-hex controls, modal interruption and ownership transfer. Actual 200% browser zoom is distinct from the suite's reduced-viewport equivalent. The unchecked full matrix above remains the acceptance inventory for the later refit; it is not a claim that every item has been implemented or reverified.
