# Weapon setup and ammunition inventory

This editor records a customized fit and inventory. It does not fire weapons, resolve salvos, apply missile effects or decide reload timing.

- Filled turret slots determine the turret label. Fixed mounts, barbettes and bays retain distinct classes. Unknown group quantities and custom weapon draws stay unknown. Published snapshots are retained.
- Turret/fixed weapon draw and mount baseline: High Guard Update 2022 pp28–29; barbette draw pp30–31; quad turret baseline and TL p81. Firmpoint limits and power reduction: p26. The fit editor checks recorded TL and known mounting limits; it does not certify every ship-design constraint.
- Missile turrets share a 12-missile load (Core Update 2022 p167 / High Guard Update 2022 p28). Firmpoint racks hold four (High Guard p28). Missile and torpedo barbettes hold 25 and three respectively (High Guard p31). Unverified fixed-Hardpoint and bay capacities remain unknown.
- Sandcaster storage is explicitly source-dependent: Core Update 2022 p168 describes 20 per turret; High Guard Update 2022 p29 describes 20 per Hardpoint-mounted sandcaster, four for a Firmpoint. An unverified basis does not choose between these.
- Railgun turret inventory uses attacks, not individual projectiles (High Guard p29). Missile-type names are configuration metadata from High Guard p36, with no automated effects.
- A capacity is not current stock. Separate reserve magazines are created only from retained published storage entries or an explicit user addition. Blank current quantities remain unknown; absent storage does not invent reserves or assert complete source coverage.
- Reloading moves a known amount from a compatible reserve to a loaded pool. Both values remain a draft until Save. Unknown counts/capacity, mismatched missile types, insufficient reserves and overcapacity block transfer.
- Existing saves do not acquire a fit or inventory merely by opening/cancelling an editor. Legacy ammunition and source values remain available; ambiguous legacy totals are not silently distributed among mixed ammunition types. Manual power and capacity overrides remain distinct from source values.
