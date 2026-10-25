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
