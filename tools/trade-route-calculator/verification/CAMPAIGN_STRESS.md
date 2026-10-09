# Five-trip synthetic campaign stress test

This is a disposable test campaign, never a user's saved campaign. Each trip starts
from byte-identical stock/settings at Drinax 2223. All later campaign mutations use
rendered Chromium controls, including route construction, naturally generated trade,
contracts, service payments, jumps, export, and reload. The supplementary adversarial
suite uses separately labeled, richer synthetic branches, not top-ups to these trips.

## Reproducibility and scope

- Public Traveller Map M1105 snapshot retrieved 2026-10-09:
  https://travellermap.com/api/jumpworlds?sector=Trojan%20Reach&hex=2223&jump=12&milieu=M1105
- Every ordinary leg was independently checked against official radius-1/radius-2
  membership. Empty 2117 returned no world at radius 0. This run intercepts API calls
  with that snapshot; it does not establish current live API availability.
- Chromium and Playwright 1.58.2 run in GitHub Actions against the exact PR head.
- Five pinned pseudo-random seeds (11052223 + route index ×1009) generate natural
  die faces through the rules' normal crypto-based die interface. Draws and committed
  price/search/jump audits are recorded. No successful-search or price overrides.
- No retry-until-profit, invented supplier, money top-up, or empty-space refueling.
- The existing 24-suite browser regression matrix and native/rules gates are preserved.
  This adds five journeys plus 21 bounded compound scenarios at 1440/390/320px.

## Baseline

200t Far Trader, Jump-2, 50t cargo, 40t fixed fuel full, empty 40t maximum bladder;
4 Middle crew +1 High passenger; 6 Middle +1 High cabins; no occupied low berths;
automatic 1t High luggage; 140 LSS (28 days), 800 LSS internal capacity; Cr400,000;
001-1105 at hour0; Broker/Admin/Streetwise2; characteristic +1; mail SOC +1, rank3.
RAW100% positive profit, normal price dice, taxes/insurance/caps/price limits off.

Mortgage: fixed Cr150,000 per28days, original Cr36,000,000, 480 payments remaining,
paid0, firstdue028-1105. Maintenance Cr2,300 per28days, firstdue028, paid0. Salary
Cr20,000 aggregate per28days, remembered directly without a fake payment. Salary
firstdue028 is a scenario assumption because the app has no salary schedule. Due028
starts at elapsed648h. Fuel scoops fitted and unarmed use application defaults as
explicit test assumptions. Only the Opening bank entry is present at setup.

A Cr60,000 operating reserve is test strategy, not an application rule. If mortgage
would spend that reserve, defer it and retain unpaid dates/counts. Salary and
maintenance are paid when due and affordable. No late-fee assumption is introduced.

## Routes

1. Theev: Drinax2223 → Torpol2221 → Marduk2120 → Noricum2018 → empty2117 → Theev2116.
   Legs2,2,2,2,1. AtNoricum acquire only enough to reach60t total (20t bladder), then
   consume40t and20t. Replenish LSS before the two-leg empty-space stretch.
2. Fist: Drinax2223 → Clarke2322 → Blue2421 → Exocet2520 → Iilgan2719 → Fist2918.
   Legs2,1,2,2,2.
3. Acis: Drinax2223 → Khusai2023 → Camoran1823 → Oiwoiieaw1723 → Akhwohkyal1621 → Acis1619.
   Legs2,2,1,2,2.
4. Fantasy: Drinax2223 → Hilfer2424 → Sink2426 → Fantasy2428. Legs2,2,2.
5. Homestead: Drinax2223 → Torpol2221 → Marduk2120 → Thebus1919 → Number One1818 → Salif1816 → Homestead1715.
   Legs2,2,2,1,2,2.

Other journeys refill only missing fuel to40t at real worlds, using refined atA/B,
unrefined atC/D. Destination Fantasy is E-port; no standard fuel purchase is invented.
Each trip must contain a committed local-broker purchase with generated broker skill,
three natural price dice, +2 local DM, 10% fee, receipt math, and a visible Audit.

## Independent oracles and evidence

Every checkpoint reconciles signed ledger to bank, exact rational five-person LSS
consumption and purchased stock, cabin/person counts, hold use including baggage and
filled bladders, fuel burn, unchanged pricing options and unique records. Native
baseline tests compare published route geometry with separate integer cube geometry.

Reports record checkpoint balances/stock/date/lots/contracts, deferrals, natural dice,
local broker proof, final campaign and runtime errors. UI screenshots accompany them.
Compact report/image bundles must stay below30MiB; traces are uploaded separately.

Known decorative follow-ups are recorded, not fixed during this run: map/MFD frame
height changes with service content even when world spacing/center stays stable;
clicking the active MFD shortcut again does not yet return to World Info.

Run the native gate with `node verification/run-native.mjs`. Browser reproduction:
`TRAVELLER_ROUTE=Theev node verification/campaign-routes-browser.test.mjs <playwright-module>`
and `node verification/campaign-stress-browser.test.mjs <playwright-module>`.
