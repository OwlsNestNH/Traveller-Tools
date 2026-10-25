# Ship token provenance

Twenty-three unmodified WebP source files by **Samuel Penn**, CC0, copied from Mongoose Publishing's Traveller FoundryVTT repository at revision `49ffb65cfbe469cd69467edfd5737c492f87d007`.

Source directory: https://github.com/Mongoose-Publishing/traveller-foundryvtt/tree/49ffb65cfbe469cd69467edfd5737c492f87d007/mgt2e/images/tokens/spacecraft/white

Mongoose credits: https://github.com/Mongoose-Publishing/traveller-foundryvtt/blob/49ffb65cfbe469cd69467edfd5737c492f87d007/README.md (Starship icons: Samuel Penn, CC0).

Author's license: https://gitlab.com/samuelpenn/spacecraft-dungeondraft/-/raw/main/LICENSE . The upstream license states that the assets and generated pack are CC0 and may be downloaded, shared, modified, used and redistributed without attribution. Credit is retained here voluntarily. No other repository artwork or code was copied.

The browser converts the source alpha to a solid silhouette using an SVG alpha threshold and side-colour filter. The source files remain unchanged, including their original orientation. These are map symbols, not facing or physical scale. Exact Empress Marava mapping is available; generic class mappings use representative tokens and do not claim that every class/variant shares the token's exact hull.

Research toroid, Corsair and Other fallback glyphs are original code-native shapes in appearance.mjs. They are labelled custom symbols, not official or canonical depictions. The edge-on upstream lab_ship token is intentionally not used.

## Mapping rationale

Mappings use the preset's book and printed page, not filename substrings or displacement. Source names/class identifiers and silhouettes were checked against the supplied Core/High Guard 2022 diagrams. Source pages and private comparison images are not redistributed. These artist tokens match the named design family; they are not certified reproductions of a particular 2022 loadout or deck plan. Hull orientation remains the artist's original orientation and never represents facing.

Core Type-A / High Guard Beowulf use free_trader; Type-A2 / Hero use far_trader, while Empress Marava has its separate token. Scout and Suleiman use scout; Serpent does not. Seeker, Yacht, Safari, Gazelle, subsidised merchant and Donosev use their distinct named tokens. Gazelle artwork includes illustrative external attachments; neither their presence nor absence determines the selected ship's tankage or performance. Its two book stat variants remain unchanged. Small craft use their distinct Launch, Gig, Military Gig, Ship's Boat, Slow Boat, Pinnace, Slow Pinnace, Modular Cutter, Shuttle and Passenger Shuttle tokens instead of borrowing Ship's Boat for all small craft.

No matching pinned token was found for Ultralight Fighter, Heavy Fighter, Troop Transport, Torpedo Boat, Express Boat, Serpent Scout, Jump Shuttle, Fleet Courier or Dragon SDB: these use the labelled custom generic symbol, never Light Fighter/Scout/SDB merely because they share a class. Nishemani Corsair uses the labelled custom Corsair fallback. Laboratory ships deliberately retain the user's custom top-down toroid preference; the available edge-on lab_ship asset is not imported. Mercenary cruiser, subsidised liner and planetoid tokens are outside this preset scope and are not imported.

The Drinax Harrier has no matching token in this pinned directory and uses the separately approved custom outline documented below.

The complete source-page mapping is explicit in appearance.mjs. A user can override a symbol manually; the choice remains presentation only.

| Source file | SHA-256 |
| --- | --- |
| close_escort.webp | `7cad0f03a7624b874d4aae4cd2a1569172bcac993468b00935109b6d539c6dec` |
| empress_marava.webp | `51ef2aafe5d9acec49fdb089c9f87f35b7949f3895eae71b2b558bf6ae9aaa79` |
| far_trader.webp | `7510e1dfce30666afdf3c6314475fa255d0621f246729d1684ea1e876d82eec9` |
| free_trader.webp | `18cc12b33950fcf75579ffe04b24a8d5e53256412aa45ccfa8850a4030bae0cb` |
| gig.webp | `17a7844db65e0cda50ab5a6169d9c2861d48903d764504ad17b38a7630ad7a46` |
| launch.webp | `e5e2350b160f6851223501abd08bf0089262028d2d0df1a83d1a58bf8178f770` |
| light_fighter.webp | `aefc7f2a61522b205010bcca37b20b13fb2e9121b0126f757ea349413bb9d4e3` |
| military_gig.webp | `00aa0804a3c6501e77d93052c8639666b3777fe2670cd73b95c7cfadb9a62fce` |
| modular_cutter.webp | `2562f2509604d1e9a1597b517d9db209233bc151974e26b253317966395ddd7c` |
| passenger_shuttle.webp | `23718d8c6062ca809b0972afd678a2326637520f4c7dd5affcee0047b2a64035` |
| patrol_corvette.webp | `f2b7098c58a5919f6c0ae56938c0a2538724c36e3695ce4aef3ac8fd5c0a6566` |
| pinnace.webp | `40a909125299bba4a622880cfbc4c7d51e37bf4fc9d44417cc6c3133a9a7f93e` |
| safari_ship.webp | `28032a2c991beffd14276714db046d959d1545c0934400f307ca77401b9e9869` |
| scout.webp | `67e4ee965531484c3d765ac46ecd03e968c33b4c35433e87c4825487e852482e` |
| seeker.webp | `a9e72dbfa82b13897e0c047a342c0677b662dda7f68972176dbee231de41822b` |
| ships_boat.webp | `ba1abc73231dbf14f7ae742442df2fe3f8f54baf02e5a9cb90ec582d7c5bf83e` |
| shuttle.webp | `f448d74ea83860a2820d59e7a8469f7b70708f73062788b74aadae3f7f1c7dcf` |
| slow_boat.webp | `54f057cc4058a2cc067fe5693ec5eb6f0092835e0aa732b862b87528c4f6f09d` |
| slow_pinnace.webp | `6ab98c1df3ab1dcd2ba957e7d579bf30405696d166779da1833c1ad83f84ddd0` |
| subsidised_merchant.webp | `89f84981fdc1bed24be53af4e2ae2bb3ca7e45856bc779c5839f9228c930cd29` |
| survey_scout.webp | `47bf9eb8efe891908a1ff6813680eab00ed2552e0cabda611ef3fa4d9b458603` |
| system_defence_boat.webp | `4a8c43277ce4dcb09aa1f4607b2bff7c0347ba81c3888f1186369908f70f7391` |
| yacht.webp | `d52f2e2999ef350d231a8688ce41726aafd96e11e3b3a8ca2a416601ca6c16e2` |

## Harrier custom outline
`harrier-custom.svg`: custom simplified reconstruction from user-supplied Harrier reference artwork, approved for this tool. Not an official supplied token, not a Samuel Penn token, and not represented as CC0. Bow axis: up (-90 degrees). Original supplied SVG retained; only runtime tint/transform applies.

SHA-256 of the approved supplied Harrier SVG: `eff09a034151a568c5bef4ac2b9224c96eb467c6561dca36d1152f6499c96985`.

## Approved deckplan interpretations (2026-10-25)

Five original simplified vector hull envelopes approved for use by the user. Not official art, not certified exact projections, and not CC0. Each uses one white filled path; no page art, raster images, scripts or external resources. Bow is up (-90 degrees). Dimensions and fit use the existing 48-unit image box.

- **armed-trader.svg**: Adventure Class Ships (2023), Mongoose Traveller (no numbered edition stated), printed pp. 22-23; PDF pp. 23-24 (1-based). Lower-deck hull contains upper deck. Rounded narrow bow, broad aft shoulders and stern recess retained. Detached turret key symbols omitted.
- **stealth-scout.svg**: Adventure Class Ships (2023), Mongoose Traveller (no numbered edition stated), printed pp. 6-7; PDF pp. 7-8 (1-based). Upper-deck envelope contains lower deck. Blunt wedge tip and shallow aft notches retained. Small visible drive ends follow the plan; no detached turret or door swings.
- **hunting-ship.svg**: Adventure Class Ships (2023), Mongoose Traveller (no numbered edition stated), printed pp. 136-137; PDF pp. 137-138 (1-based). Lower-deck envelope combines circular hull, long lateral fins and paired aft projections; upper deck fits inside it after centre alignment. Illustration corroborates disc and fins. Plan faces right; normalized bow points up. Fin outlines and front docking contour remain interpreted, not exact.
- **kashu-fighter.svg**: Small Craft Catalogue (2023), Mongoose Traveller (no numbered edition stated), printed pp. 51; PDF pp. 52 (1-based). Same-page deckplan and illustration. Narrow bow, unswept plan wings, small wingtip projections and central aft drive envelope retained. Floating weapon key icons excluded; no perspective-derived weapons added.
- **extended-scout.svg**: Adventure Class Ships (2023), Mongoose Traveller (no numbered edition stated), printed pp. 8-9; PDF pp. 9-10 (1-based). Upper-deck envelope contains lower deck. Broad straight trailing wing edges and long rounded forward fuselage retained. Perspective illustration confirms fins; no extra vertical-fin projection invented.

These mappings apply to the five source identities only. Fresh samples now use automatic mapping. Explicit icons in existing encounters remain user choices and are not migrated. The following section documents later source-specific additions.

## Source-grounded batch 02

Original vector interpretations under the user-approved representation-level accuracy standard. Independent visual review found no required fixes. No private source links, book images or purchaser identifiers are included.

- **ifteaa.svg**: Traders and Gunboats (2024), printed pp. 8-9; PDF pp. 9-10 (1-based). Central hull from plan; broad lateral fins reasonably inferred from illustration. Fin span, sweep and placement are approximate, simplified for small tokens.
- **frontiersman.svg**: Adventure Class Ships (2023), printed pp. 10-11; PDF pp. 11-12 (1-based). Lower-deck exterior dominates; upper deck is contained. Long narrow forebody expands into broad aft wedge. Two stern notches retained, interior machinery omitted. Illustration confirms elongated scout wedge.
- **far-scout.svg**: Adventure Class Ships (2023), printed pp. 12-13; PDF pp. 13-14 (1-based). Largest middle-deck envelope with broad aft tank and terminal drive. Other decks aligned along longitudinal centreline rather than placed beside it. Illustration corroborates enlarged aft body and narrow forward section. Chamfered tank corners simplify the rounded exterior.
- **free-smuggler.svg**: Adventure Class Ships (2023), printed pp. 24-25; PDF pp. 25-26 (1-based). Rendered plan and illustration show the same outer hull family/proportions as Armed Trader: narrow rounded nose, broad aft shoulders, twin stern corners. Reuses that approved contour as a source-corroborated exterior family match; interior conversion does not alter silhouette.
- **volitant-far-trader.svg**: Adventure Class Ships (2023), printed pp. 26-27; PDF pp. 27-28 (1-based). Single-deck exterior: rounded cockpit lobe, narrow neck, widening centre hull, broad swept wings and two aft blocks. Illustration corroborates fins. Distinct from Core Type A2/Hero and Empress Marava silhouettes.

Far Scout is intentionally slender (roughly 4px wide at a 24px token); preserve proportions and use labels rather than arbitrarily widening it. Each asset has one white path, no scripts or external references, and bow up (-90 degrees). Existing explicit user choices remain untouched.

## Source-grounded batch 03

Original vector interpretations under the user-approved representation-level accuracy standard. Independent visual review found no required fixes. No private source links, book images or purchaser identifiers are included.

- **medical-scout.svg**: Adventure Class Ships (2023), printed pp. 14-15; PDF pp. 15-16 (1-based). Aligned three decks on common centreline. Upper deck bow and middle/upper body form combined envelope; narrow aft docking neck and broad terminal drive retained. Lower deck is contained. Illustration corroborates separated rear block.
- **shadow-trader.svg**: Adventure Class Ships (2023), printed pp. 28-29; PDF pp. 29-30 (1-based). Lower deck gives complete envelope: rounded narrow bow, long taper, broad swept aft fins and paired stern corners. Upper deck contained; illustration confirms aerodynamic hull. Fine guns omitted.
- **merchant-trader.svg**: Adventure Class Ships (2023), printed pp. 30-31; PDF pp. 31-32 (1-based). Main deck exterior includes broad stepped retractable aerofins and twin aft projections with central notch. Rounded forward cabin and main hull confirmed by illustration. Fuel-only lower deck adds no external extension.
- **antique-trader.svg**: Adventure Class Ships (2023), printed pp. 32-33; PDF pp. 33-34 (1-based). Four decks aligned longitudinally; deck 3 bounds central rounded cargo body, projecting bow bridge and aft machinery pod. Deck 2 rear pod is contained in same envelope. Illustration confirms cylindrical hull and separate end modules; fine antennae omitted.
- **fast-smuggler.svg**: Adventure Class Ships (2023), printed pp. 34-35; PDF pp. 35-36 (1-based). Single-deck outer hull traced as broad rounded forward shoulders, pointed nose and long narrowing stern. Illustration confirms smooth flattened hull. Interior fuel borders and detached turret symbols excluded.
- **fast-luxury-transport.svg**: Adventure Class Ships (2023), printed pp. 58-59; PDF pp. 59-60 (1-based). Plan outer envelope retains narrow long bow, broad aft wings and split stern projection. Illustration corroborates racing form. Swept thin surface detail omitted; plan proportions govern.
- **express-packet.svg**: Adventure Class Ships (2023), printed pp. 78-79; PDF pp. 79-80 (1-based). Main deck envelope retains forward shoulders, waisted centre and broad aft engine housing. Smaller second deck aligned and contained. Illustration supports twin aft lobes; interior fuel edges excluded.
- **jump-cutter.svg**: Adventure Class Ships (2023), printed pp. 80-81; PDF pp. 81-82 (1-based). Exterior with all four standard modules fitted, as illustrated: narrow bow, two transverse fins, parallel module sides and forked aft projection. Dashed module attachment boundaries are not treated as openings.
- **long-range-courier.svg**: Adventure Class Ships (2023), printed pp. 82-83; PDF pp. 83-84 (1-based). Main deck exterior gives flattened rounded bow, broad middle shoulders and long taper to squared stern. Separate underside fuel rectangles are aligned beneath main hull, not copied beside it. Illustration corroborates envelope.
- **hospice-boat.svg**: Adventure Class Ships (2023), printed pp. 84-85; PDF pp. 85-86 (1-based). Aligned upper and lower decks have the same outer envelope: rounded clipped bow, tapered forebody and two stepped shoulders before rectangular aft body. Illustration corroborates broad medical hull. No separated deck duplication.

Far Scout is intentionally slender (roughly 4px wide at a 24px token); preserve proportions and use labels rather than arbitrarily widening it. Each asset has one white path, no scripts or external references, and bow up (-90 degrees). Existing explicit user choices remain untouched.

## Source-grounded batch 04

Original vector interpretations under the user-approved representation-level accuracy standard. Independent visual review found no required fixes. No private source links, book images or purchaser identifiers are included.

- **prison-ferry.svg**: Adventure Class Ships (2023), printed pp. 86-87; PDF pp. 87-88 (1-based). Lower deck exterior governs combined envelope. Offset starboard fuel section and narrow stern notch deliberately retained rather than symmetrised from perspective art. Upper deck aligned over main longitudinal block; illustration confirms box-like hull.
- **prospector.svg**: Adventure Class Ships (2023), printed pp. 88-89; PDF pp. 89-90 (1-based). Aligned three decks; middle deck broad body and longitudinal side fuel housings govern exterior. Forked stern retained. Lower deck short view and upper accommodation outline remain within envelope. Illustration confirms long lateral housings.
- **strike-scout.svg**: Adventure Class Ships (2023), printed pp. 98-99; PDF pp. 99-100 (1-based). Broad triangular Type S-derived exterior traced from published plan, with three aft projections and intervening recesses. Illustration confirms wedge. Separate turret diagram excluded.
- **light-reconnaissance.svg**: Adventure Class Ships (2023), printed pp. 100-101; PDF pp. 101-102 (1-based). Lower-deck outline combines aligned upper deck, long forward sensor boom, side pods, thin transverse array and two rear tanks. Illustration confirms array structure; twin fine boom rods simplified to one visible stem at token scale. Crossbar represents edge-on array projection, not a filled disc.
- **pirate-carrier.svg**: Adventure Class Ships (2023), printed pp. 102-103; PDF pp. 103-104 (1-based). Combined aligned decks retain long rectangular hull and five docking-clamp tabs per side. Upper deck extends beyond lower stern; both views share scale. Carried fighter silhouettes excluded, so same hull serves loaded and unloaded catalog entries. Illustration confirms long carrier body.
- **assault-gunship.svg**: Adventure Class Ships (2023), printed pp. 104-105; PDF pp. 105-106 (1-based). Aligned decks give rounded long cylindrical hull and narrower aft drive block. Small paired aft fins reasonably inferred from illustration; fin span and placement approximate. Fine guns and detached turret symbols omitted.
- **valour-missile-corvette.svg**: Adventure Class Ships (2023), printed pp. 106-107; PDF pp. 107-108 (1-based). Middle-deck central envelope aligned with upper/lower decks. Paired aft fuel pods positioned from detached deck rectangles and illustration, with approximate short connections and rounded forward caps. Four vertically stacked pods project as two in top view. Interpreted placement; no detached turret diagrams.
- **executive-yacht.svg**: Adventure Class Ships (2023), printed pp. 116-117; PDF pp. 117-118 (1-based). Single-deck exterior with rounded tapered bow, wide rectangular side tanks and long tapering stern. Illustration confirms broad shoulder blocks; fine vertical tail surfaces stay inside top projection.
- **huntress-warrant-ship.svg**: Adventure Class Ships (2023), printed pp. 118-119; PDF pp. 119-120 (1-based). Single deck outer envelope: narrow clipped bow, long tapered wedge and swept broad stern shoulders. Illustration corroborates flat angular hull. Detached weapon symbol excluded.
- **custom-safari-ship.svg**: Adventure Class Ships (2023), printed pp. 120-121; PDF pp. 121-122 (1-based). Broad transverse exterior traced from complete plan, including central aft docking extension, paired narrow aft rails and end caps. Bridge/sensors on right establish bow; rotated right-to-up. Illustration confirms wide wing-like silhouette. Pool is internal, not a through-hull hole.
- **desiree-keah-yacht.svg**: Adventure Class Ships (2023), printed pp. 122-123; PDF pp. 123-124 (1-based). Aligned three-deck envelope has pointed tapering bow and broad long aft body with chamfered stern. Small swept lateral aerofins inferred from illustration, with approximate span/position; lower docking deck contained. No duplicate adjacent decks.
- **blockade-runner.svg**: Adventure Class Ships (2023), printed pp. 124-125; PDF pp. 125-126 (1-based). Largest middle deck defines rounded forebody, parallel main hull and chamfered aft projection. Upper reaction-drive tail and lower docking deck fit within aligned envelope. Illustration confirms long smooth hull; internal machinery not traced.
- **touring-ship.svg**: Adventure Class Ships (2023), printed pp. 126-127; PDF pp. 127-128 (1-based). Upper forward bridge aligned with wider lower theatre hull on common centreline and shoulder station. Combined envelope preserves narrow bow stalk and wide rectangular aft venue. Closed stage-door configuration; illustration confirms stepped form.

Far Scout is intentionally slender (roughly 4px wide at a 24px token); preserve proportions and use labels rather than arbitrarily widening it. Each asset has one white path, no scripts or external references, and bow up (-90 degrees). Existing explicit user choices remain untouched.

## Source-grounded batch 05

Original vector interpretations under the user-approved representation-level accuracy standard. Independent visual review found no required fixes. No private source links, book images or purchaser identifiers are included.

- **stayaow-combat-scout.svg**: Adventure Class Ships (2023), printed pp. 134-135; PDF pp. 135-136 (1-based). Lower deck full exterior governs long tapered hull, rounded clipped nose and broad flared stern. Upper deck lies within envelope. Illustration confirms stern wings and elongated scout hull.
- **sceaf-personal-yacht.svg**: Adventure Class Ships (2023), printed pp. 142-143; PDF pp. 143-144 (1-based). Combined decks aligned at stern and machinery: broad lower forward hull, midbody fins, narrower upper body and aft outrigger pods. Right fin partly clipped in plan; reflected from left with illustration corroboration. Pod alignment interpreted; preserves two distinct lateral pairs.
- **sleipnir-patroller.svg**: Adventure Class Ships (2023), printed pp. 144-145; PDF pp. 145-146 (1-based). Main deck perimeter gives long rounded forebody and slightly narrower squared engine stern. Dashed lower view confirms contained fuel deck. Illustration corroborates slender cylindrical form; detached weapon symbols excluded.
- **rokkghiok-stealth-runner.svg**: Adventure Class Ships (2023), printed pp. 150-151; PDF pp. 151-152 (1-based). Matching upper/lower exterior outlines aligned, not placed alongside each other. Long tapered bow and broad stepped aft fins retained. Bridge and sensors point right in source, rotated up. Illustration corroborates aft fins.
- **nguksu-fast-trader.svg**: Adventure Class Ships (2023), printed pp. 152-153; PDF pp. 153-154 (1-based). Lower deck exterior dominates with narrow bow, tapering central hull, broad aft fins and rectangular fuel pod bands. Upper deck contained. Source points right; rotated up. Illustration confirms broad aft wing assemblies.
- **civilian-hopper.svg**: Small Craft Catalogue (2023), printed pp. 15; PDF pp. 16 (1-based). Main deck exterior gives two chamfered blocks joined by narrow neck. Smaller machinery deck aligned over aft block, contained. Illustration confirms articulated utility body; thin tow cable omitted.
- **advertising-boat.svg**: Small Craft Catalogue (2023), printed pp. 16; PDF pp. 17 (1-based). Aligned two decks show two long display/body blocks linked by central neck. Bridge at right establishes bow, rotated up. Illustration confirms billboard form. Thin antenna omitted; projected plan dimensions preserved.
- **cargo-shuttle.svg**: Small Craft Catalogue (2023), printed pp. 17; PDF pp. 18 (1-based). Complete plan exterior includes broad swept aft wings, narrow rounded bow and small rear machinery projection. Source bow right, rotated up. Illustration corroborates wedge and aft wings.
- **smugglers-pinnace.svg**: Small Craft Catalogue (2023), printed pp. 18; PDF pp. 19 (1-based). Plan outer hull with broad triangular aft wings and smaller forward fins. Two exposed rear drive ends retained. Rounded cockpit points right in source, rotated up. Illustration confirms aerodynamic form.
- **short-shuttle.svg**: Small Craft Catalogue (2023), printed pp. 19; PDF pp. 20 (1-based). Main deck exterior preserves long passenger body, rounded bow, broad mid/aft swept fins and small rear engine taper. Source points right, rotated up; detached interior seat outlines excluded.
- **fast-shuttle.svg**: Small Craft Catalogue (2023), printed pp. 20-21; PDF pp. 21-22 (1-based). Main deck exterior includes pointed rounded forebody, parallel passenger hull, broad swept side fins and tapered aft machinery. Upper deck aligned and contained. Illustration confirms shoulders and twin aft drives.
- **trade-shuttle.svg**: Small Craft Catalogue (2023), printed pp. 22-23; PDF pp. 23-24 (1-based). Main deck full envelope retains two lateral fin pairs, rounded clipped bow and narrow aft drives. Upper deck contained. Illustration corroborates swept wings; interior cabin boundaries omitted.
- **extended-passenger-shuttle.svg**: Small Craft Catalogue (2023), printed pp. 24-25; PDF pp. 25-26 (1-based). Single-deck exterior gives broad delta aft wings and twin stern drive ends, with long passenger fuselage and rounded clipped bow. Illustration confirms swept wing geometry. Vertical tail surfaces stay inside top projection.

Far Scout is intentionally slender (roughly 4px wide at a 24px token); preserve proportions and use labels rather than arbitrarily widening it. Each asset has one white path, no scripts or external references, and bow up (-90 degrees). Existing explicit user choices remain untouched.

## Source-grounded batch 06

Original vector interpretations under the user-approved representation-level accuracy standard. Independent visual review found no required fixes. No private source links, book images or purchaser identifiers are included.

- **automated-lifeboat.svg**: Small Craft Catalogue (2023), printed pp. 27; PDF pp. 28 (1-based). Chamfered rectangular exterior follows single-deck plan. Aft drive projections simplified into clipped stern. No bridge; forward direction inferred opposite drives at right in source, rotated up. Illustration confirms capsule body.
- **freight-handler-pod.svg**: Small Craft Catalogue (2023), printed pp. 28; PDF pp. 29 (1-based). Rounded pod with side machinery and rectangular projected grappling arm envelope. Three short claw fingers indicate working end; arm is shown in published stowed/straight plan pose. Cockpit faces right, rotated up. Illustration corroborates asymmetric utility fittings.
- **transporter.svg**: Small Craft Catalogue (2023), printed pp. 29; PDF pp. 30 (1-based). Single deck hull, paired aft drives, lateral docking clamps and forward grappling block retained. No external cargo container drawn. Arm fingers simplified in plan pose. Right-facing cockpit establishes bow; rotated up.
- **utility-pod.svg**: Small Craft Catalogue (2023), printed pp. 30; PDF pp. 31 (1-based). Asymmetric exterior preserves dorsal-plan docking clamp, broad cockpit body and narrowing forward arm block. Thin tow cable omitted. Grapple shortened to legible finger marks; right-facing source rotated up. Illustration corroborates offset clamp.
- **tradesmans-gig.svg**: Small Craft Catalogue (2023), printed pp. 31; PDF pp. 32 (1-based). Single-deck exterior combines broad rear workshop body, narrow forward accommodation and smaller grapple block. Right-facing source rotated up. Fine fingers simplified; interior workshop walls excluded. Illustration confirms stepped utility hull.
- **belter-launch.svg**: Small Craft Catalogue (2023), printed pp. 32; PDF pp. 33 (1-based). Long rectangular cargo body, rounded forward cockpit and short drill projection traced from plan. Source points right, rotated up. Drill length simplified at token scale, with ring head reduced to stepped stem. Illustration confirms cylindrical hull.
- **customs-launch.svg**: Small Craft Catalogue (2023), printed pp. 33; PDF pp. 34 (1-based). Rounded launch-family hull follows complete single-deck exterior, with clipped aft drive section. Right-facing bridge/sensors establish bow; rotated up. Weapon diagram above plan is a legend, excluded from hull.
- **lifeboat.svg**: Small Craft Catalogue (2023), printed pp. 34; PDF pp. 35 (1-based). Published plan and illustration corroborate standard rounded launch-family envelope; same exterior contour as Customs Launch, with different internal rescue fit. Aft machinery taper retained; detached interior furnishings excluded.
- **medical-launch.svg**: Small Craft Catalogue (2023), printed pp. 35; PDF pp. 36 (1-based). Same launch-family exterior as independently inspected Lifeboat and Customs Launch plans, despite medical internal conversion. Reuses that corroborated outer contour. Bow right in source, rotated up; machinery taper retained.
- **rescue-boat.svg**: Small Craft Catalogue (2023), printed pp. 36; PDF pp. 37 (1-based). Broad utility rescue hull with shallow side recesses, paired rear drives and rounded clipped cockpit. Grappling arm shown as stowed within hull envelope; thin cable omitted. Bow right, rotated up.
- **modular-skiff.svg**: Small Craft Catalogue (2023), printed pp. 37; PDF pp. 38 (1-based). Complete single-deck exterior with standard module fitted: long parallel hull, rounded forward bridge and narrower aft engine block. Illustration confirms cylinder; module boundary is not a through-hull gap. Bow right, rotated up.
- **research-pinnace.svg**: Small Craft Catalogue (2023), printed pp. 38; PDF pp. 39 (1-based). Published exterior traced with broad rear wings, smaller forward fins, rounded cockpit and paired rear drive ends. Similar pinnace family to smuggler variant, independently traced to source proportions. Bow right, rotated up; fine antennae omitted.

Far Scout is intentionally slender (roughly 4px wide at a 24px token); preserve proportions and use labels rather than arbitrarily widening it. Each asset has one white path, no scripts or external references, and bow up (-90 degrees). Existing explicit user choices remain untouched.

## Source-grounded batch 07

Original vector interpretations under the user-approved representation-level accuracy standard. Independent visual review found no required fixes. No private source links, book images or purchaser identifiers are included.

- **customs-patrol-boat.svg**: Small Craft Catalogue (2023), printed pp. 39; PDF pp. 40 (1-based). Complete plan exterior retains broad central hull, short forward cockpit taper, paired stern machinery and small swept rear fins. Grapple shown stowed. Detached turret diagram excluded. Bow right, rotated up.
- **fast-cutter.svg**: Small Craft Catalogue (2023), printed pp. 40; PDF pp. 41 (1-based). Single-deck full exterior with fitted standard module: long parallel body, rounded forward bridge and broad stepped aft machinery. Module remains solid; internal module boundary not a hole. Illustration confirms cylinder. Bow right, rotated up.
- **ship-to-ship-shuttle.svg**: Small Craft Catalogue (2023), printed pp. 41; PDF pp. 42 (1-based). Plan exterior preserves box-like cargo body, offset grapple housing, tapering forward cabin and small aft drive projection. Grapple retracted within housing. Illustration confirms rectangular freight hull. Bow right, rotated up.
- **traffic-control-router.svg**: Small Craft Catalogue (2023), printed pp. 42; PDF pp. 43 (1-based). Aligned decks combine central body, forward cockpit protrusion and rear drive. Broad curved solar panels retained as separated strips connected by crossbar, preserving open gaps. Panels in plan pose; not a solid disc. Illustration corroborates paired curved arrays.
- **heavy-modular-cutter.svg**: Small Craft Catalogue (2023), printed pp. 43-44; PDF pp. 44-45 (1-based). Complete fitted two-module exterior includes rounded long bow, broad twin-module body, swept rear wings and tapering rear machinery. Illustration corroborates wide twin-cylinder form. Central module spine is solid, not a through-hull gap.
- **homeshield-mini-fighter.svg**: Small Craft Catalogue (2023), printed pp. 46; PDF pp. 47 (1-based). Main-deck exterior with broad swept side wings and clipped dual-cockpit nose. Small second machinery deck aligned over rear body, contained. Detached missile diagram excluded. Illustration confirms compact fighter.
- **cyclone-attack-fighter.svg**: Small Craft Catalogue (2023), printed pp. 47; PDF pp. 48 (1-based). Single-deck outer envelope retains long tapered nose, broad near-straight wings and wingtip rails. Detached weapons excluded. Illustration corroborates wings and narrow fuselage; fine guns omitted.
- **moray-antique-fighter.svg**: Small Craft Catalogue (2023), printed pp. 48; PDF pp. 49 (1-based). Plan perimeter gives sharp nose, flared delta wings and concave aft edge around central drive. Illustration confirms triangular form. Cockpit/interior fuel borders and detached weapon symbol excluded.
- **sentinel-escort-fighter.svg**: Small Craft Catalogue (2023), printed pp. 49; PDF pp. 50 (1-based). Broad rounded forward cockpit/body and two long aft drive arms with open central gap. Source cockpit faces right, rotated up. Illustration corroborates forked rear. Detached turret diagram excluded.
- **junker-fighter.svg**: Small Craft Catalogue (2023), printed pp. 50; PDF pp. 51 (1-based). Asymmetric dispersed hull combines large offset fuel slab, rounded dual-cockpit section, side missile box and two unequal rear machinery projections. Geometry follows complete single plan; detached turret key omitted. Illustration corroborates improvised offset assembly.
- **jester-covert-fighter.svg**: Small Craft Catalogue (2023), printed pp. 52; PDF pp. 53 (1-based). Complete plan has sharp long nose, broad transverse wings and stepped aft drives. Bow right in source, rotated up. Illustration confirms angular stealth fighter; detached turret diagram excluded.
- **vanguard-assault-fighter.svg**: Small Craft Catalogue (2023), printed pp. 53; PDF pp. 54 (1-based). Plan outer envelope retains broad parallel missile-storage rear body and smoothly tapering pointed bow. Two stern drive ends are simplified but remain distinct. Source right-facing, rotated up. Illustration corroborates broad ovoid forward hull; interior missile racks omitted.

Far Scout is intentionally slender (roughly 4px wide at a 24px token); preserve proportions and use labels rather than arbitrarily widening it. Each asset has one white path, no scripts or external references, and bow up (-90 degrees). Existing explicit user choices remain untouched.
