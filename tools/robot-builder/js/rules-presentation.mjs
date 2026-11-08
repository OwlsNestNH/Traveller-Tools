// Presentation policy only. Keep rich engine diagnostics and source audits out of
// the user-facing projection; never change rule decisions or construction totals.
export const labelText = value => String(value).replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[-_:]/g,' ').replace(/^./,ch=>ch.toUpperCase());
const diagnosticLabels = {
 EXTERNAL_WEAR_CONVENTION:'Select external-wear accounting assumption', EXTERNAL_WEAR_ARM:'Select existing base or additional arm', EXTERNAL_WEAR_SITE:'Select supported wear site', EXTERNAL_WEAR_ROUTE:'Select supported external-wear route', EXTERNAL_WEAR_RETAINED:'Clear unsupported retained settings', EXTERNAL_WEAR_UNUSED_SITE:'Clear retained wear site', EXTERNAL_WEAR_FIT:'Fit unverified; referee review', EXTERNAL_WEAR_OVERLAP:'Compatibility unresolved; overlapping acquisitions', EXTERNAL_WEAR_ASSUMPTION:'Referee accounting assumption; not RAW',
 COMPOSITE_METAMORPHIC_SOURCE:'Provisional source body excluded; brain/software only',
 METAMORPHIC_PROVISIONAL:'Provisional metamorphic assumptions; current form only', METAMORPHIC_TL:'Metamorphic tier TL exceeds design',
 VEHICLE_OPTION_PHYSICAL_SIZE_UNRESOLVED:'Physical size price basis unresolved', VEHICLE_OPTION_ALLOCATION_INAPPLICABLE:'Reset retained allocated Spaces to 1; not applicable',
 VEHICLE_OPTION_CHARGES_INAPPLICABLE:'Clear retained charges; not applicable', VEHICLE_OPTION_MEDIUM_INAPPLICABLE:'Clear retained sampler medium; not applicable', VEHICLE_OPTION_MEDIUM_REQUIRED:'Select one sampler medium',
 VEHICLE_UTILITY_CONTEXT:'Utility reach/deployment/operation conditional', VEHICLE_UTILITY_POWER_CONDITIONAL:'Utility power/readiness conditional', VEHICLE_UTILITY_POWER_UNAVAILABLE:'Utility power unavailable; hardware retained',
 VEHICLE_OPTION_TL:'Vehicle option TL exceeds design', VEHICLE_OPTION_CONTEXT:'Deployment/interface conditional; referee review',
 VEHICLE_OPTION_LOAD_UNKNOWN:'Initial contents unverified; replacement price unknown', VEHICLE_OPTION_CHARGES_UNPRICED:'Additional charges: price/mass unresolved',
 NANO_PERMANENT_END:'Permanent END loss; above 15 active medical packages', NANO_UNTYPED_ACTIVE:'Active package types unknown; effects incomplete', NANO_LEGACY_AGEING_UNRESOLVED:'Existing anti-ageing declaration unresolved', NANO_ATTRIBUTE_PACKAGES:'Characteristic enhancement package count insufficient', NANO_ATTRIBUTE_TARGET:'Select characteristic enhancement target', NANO_ATTRIBUTE_MAX:'Characteristic enhancement maximum exceeded', NANO_REGEN_LIMIT:'Regenerative active-package limit exceeded (4)', NANO_AGEING_SINGLE:'Anti-ageing active-package limit exceeded (1)', PARTIAL_COVERAGE:'Coverage incomplete', KIND_NOT_IMPLEMENTED:'Construction type not implemented', SPECIAL_NOT_IMPLEMENTED:'Construction path not implemented',
 HELD_MULTI_ARM_CHARACTERISTICS:'Combined-arm characteristics unresolved', HELD_CARRYING_FIT:'Carrying/reach unresolved; referee approval required',
 HELD_HANDEDNESS_INTERPRETATION:'Two-handed use: source interpretation', HELD_ONE_HANDED_INTERPRETATION:'One-handed use: source interpretation', HELD_STRENGTH_CONDITION:'Bulky STR requirement; attack penalty conditional',
 HELD_SUPPORT_REQUIRED:'Requires second grip; select an installed arm', HELD_GRIPS_MUST_DIFFER:'Grips must differ; select another arm',
 HELD_SUPPORT_UNSUPPORTED:'Second grip unsupported; clear selection', HELD_GRIP_OCCUPIED:'Grip already occupied; choose a free arm',
 HELD_VEHICLE_WEAPON_UNRESOLVED:'Held vehicle weapon unresolved; select body mount', HELD_WEAPON_MOUNT:'Linked weapons/autoloader require a mount',
 WEAPON_UNUSED_SUPPORT:'Support grip requires held placement; clear selection', WEAPON_UNUSED_ARM:'Body mount: clear arm selection',
 WEAPON_ARM_REQUIRED:'Requires installed arm', WEAPON_ARM_SIZE:'Arm size insufficient', WEAPON_TL:'Weapon/fire-control TL exceeds design',
 WEAPON_ATTACK_CONTEXT:'Attack modifier unresolved; contextual', WEAPON_SOURCE_INTERPRETATION:'Selected weapon source interpretation',
 SOURCE_INTERPRETATION:'Selected source interpretation', CONDITIONAL_OPERATION:'Conditional operation',
 MAGAZINE_SOURCE_INCOMPATIBLE:'Magazine source incompatible; select receiving or compatible source', CSC_ARL_MAGAZINE_MASS_CONVENTION:'Magazine mass estimated; source-magazine basis convention', CSC_ARL_HIGH_CAPACITY_COMPOSITION:'Cross-fit high-capacity: combined rules; referee approval required',
 CSC_HIGH_CAPACITY_REFEREE:'High-capacity suitability: referee approval required', CSC_HIGH_CAPACITY_TL:'High-capacity magazines require TL4',
 CSC_HIGH_CAPACITY_UNSUPPORTED:'High-capacity compatibility unresolved', CSC_REPLACEMENT_AMMUNITION_UNAVAILABLE:'Unknown replacement price; included supply only',
 WEAPON_AMMUNITION_PRICE_UNRESOLVED:'Unknown replacement price', AUTOLOAD_ALLOCATION_LIMIT:'Loader limit exceeded; maximum 10',
 AUTOLOAD_ALLOCATION_EXCEEDS_SUPPLY:'Loader allocation exceeds supplies; reduce allocation', AUTOLOAD_ALLOCATION_WITHOUT_LOADER:'Loader allocation requires autoloader',
 STORED_AMMO_APPLICATION_LIMIT:'Stored reserves exceed application limit (100 per copy)',
 AMMUNITION_COPY_NOT_INSTALLED:'Retained copy not installed; restore count or remove override',
 AMMUNITION_STORAGE_CAPACITY:'Storage capacity exceeded; reduce or reassign cargo', SPARE_AMMO_STORAGE:'Spare storage capacity/estimate unresolved',
 SPARE_AMMO_STORAGE_REQUIRED:'Assign installed spare-ammunition storage', AMMUNITION_STORAGE_REQUIRED:'Assign installed loose-round storage',
 SPARE_AMMO_STORAGE_UNSUPPORTED:'Spare-ammunition mass estimate unavailable', SPARE_AMMO_STORAGE_AUTOLOADER:'Loader supplies cannot also reserve storage',
 UNUSED_SPARE_AMMO_STORAGE:'Storage assigned without spare loads; clear or add loads', UNUSED_AMMUNITION_STORAGE:'Storage assigned without loose rounds',
 AMMUNITION_HAZARD_CLASSIFICATION:'Hazardous handling unresolved; referee approval required', EMPTY_AUTOLOADER:'Empty loader price unresolved; select 1–10 loads',
 AUTOLOADER_AMMUNITION:'Autoloader requires finite magazine/power pack', AUTOLOADER_TL:'Autoloader requires TL6',
 INCLUDED_POWER_PACK:'Included initial power pack required', WEAPON_AMMO_INAPPLICABLE:'No separate magazine; clear ammunition settings',
 EXPENDABLE_MELEE_INITIAL_SELECTION:'Single-use weapon; reset initial selection', EXPENDABLE_MELEE_ALLOCATION:'Single-use weapon; clear supply allocation', EXPENDABLE_MELEE_COPY_SUPPLY:'Single-use weapon; clear copy supply settings', EXPENDABLE_MELEE_SUPPLY_UNAVAILABLE:'Single-use weapon; clear spares/autoloader',
 POWERED_MELEE_INITIAL_SELECTION:'Hardware-only acquisition; reset initial magazine selection', POWERED_MELEE_ALLOCATION:'Power-supply allocation unsupported; clear allocation', POWERED_MELEE_SUPPLY_UNAVAILABLE:'Powered melee replacement supply unpriced; clear spares/autoloader',
 AMMUNITION_INAPPLICABLE:'Selectable grenade ammunition inapplicable', AMMUNITION_TL:'Ammunition TL exceeds design',
 GRENADE_AMMUNITION:'Select grenade ammunition', AUXILIARY_AMMUNITION:'Select auxiliary-launcher grenade', INTEGRAL_AMMUNITION:'Select included-launcher grenade',
 AUXILIARY_UNUSED_AMMUNITION:'Auxiliary ammunition requires launcher', INTEGRAL_UNUSED_AMMUNITION:'Included-launcher fields require both launchers',
 AUXILIARY_AMMUNITION_TL:'Auxiliary grenade TL exceeds design', INTEGRAL_AMMUNITION_TL:'Included grenade TL exceeds design',
 AUXILIARY_INTEGRAL_WEAPON:'Included launcher requires Advanced Combat Rifle', AUXILIARY_RIFLE_REQUIRED:'Attached launcher requires compatible rifle',
 AUXILIARY_TL:'Attached launcher requires TL7', AUXILIARY_MOUNT_FIT:'Combined launcher mount fit unresolved',
 ACR_INCLUDED_LAUNCHER_UNCONFIGURED:'Included rifle-grenade launcher not configured', LOOSE_GRENADE_ASSOCIATION:'Loose rounds require configured grenade attack',
 DIRECT_PAYLOAD_TARGETING_UNRESOLVED:'Direct-payload targeting unresolved; FCS inactive', DIRECT_PAYLOAD_AUTOLOADER:'Direct payload: autoloader unsupported',
 DIRECT_PAYLOAD_ACCESSORY:'Direct-payload accessory compatibility unresolved', DIRECT_PAYLOAD_LINKED_EFFECT:'Linked payload effects unresolved',
 DESTRUCTIVE_LINKED_DAMAGE:'Linked destructive damage unresolved', CSC_ACCESSORY_MOUNT_MASS_UNRESOLVED:'Weapon/accessory mount mass unresolved',
 CSC_ACCESSORIES_UNSUPPORTED:'CSC accessory compatibility unsupported', CSC_AMMUNITION_UNSUPPORTED:'Selected ammunition unsupported for source',
 CSC_LAUNCHERS_UNSUPPORTED:'Selected launcher/storage combination unsupported', CSC_FOF_TAG_ASSOCIATION:'Extra FOF tags require compatible safety accessory',
 ACCESSORY_SOURCE:'Accessory source incompatible', ACCESSORY_FAMILY:'Select one accessory per family', ACCESSORY_TL:'Accessory TL exceeds design',
 GYROSTABILISER_WEAPON:'Gyrostabiliser requires Bulky, non-Destructive weapon', SCOPE_WEAPON:'Scope requires rifle/heavy weapon',
 SUPPRESSOR_WEAPON:'Suppressor requires non-automatic slug weapon',
 SLOTS_EXCEEDED:'Slot capacity exceeded', BANDWIDTH_EXCEEDED:'Bandwidth capacity exceeded', DEFAULT_SUITE_CAPACITY:'Default-suite capacity exceeded',
 MIN_TL:'Minimum TL not met', OPTION_DEPENDENCY:'Required equipment missing', OPTION_DETAIL:'Enter required equipment detail',
 OPTION_EXCLUSIVE:'Conflicting options; select one', OPTION_INCOMPATIBLE:'Incompatible option', OPTION_NOT_IMPLEMENTED:'Option not implemented',
 OPTION_PRICE_INTERPRETATION:'Select price interpretation', OPTION_OPERATION_SKILL:'Required operating skill missing', EQUIPMENT_INACTIVE_SKILL:'Equipment inactive; required skill missing',
 REFEREE_BROAD_SKILL:'Broad speciality: referee approval required', SPECIALITY_REQUIRED:'Select required speciality',
 EXTERNAL_OPTION_UNVERIFIED:'External source/installation unverified', EXTERNAL_EQUIVALENCE_REQUIRED:'Resolve Handbook option equivalence',
 EXTERNAL_HOST_DEPENDENCY:'External host unverified', COMPOSITE_CHILD_STATUS:'Component needs correction or source decision',
 CLONE_AGEING_ROLLS:'Ageing rolls outstanding; characteristics not certified', CLONE_CRECHE_CALENDAR:'Creche calendar interpretation required',
 CLONE_PRINTED_CALENDAR_RANGE:'Printed calendar conflict: 33/34 years', CLONE_IMMATURE_CHARACTERISTICS:'Immature characteristics unresolved',
 CLONE_PARTIAL_CRECHE:'Partial creche year; no completed-year grant', CLONE_PARTIAL_CRECHE_INTERPRETATION:'Partial-year interpretation selected',
 CLONE_SCOPE:'Clone character scope unresolved', LONG_RANGE_PRICE:'Individual long-range missile price unresolved',
 NANO_LEGACY_AGEING_HIGH_TL:'Legacy high-TL ageing estimate', NANO_AGEING_HIGH_TL_UNRESOLVED:'High-TL ageing effect unresolved',
};
export function diagnosticLabel(issue) {
 const code=String(issue?.code||'');
 if(diagnosticLabels[code])return diagnosticLabels[code];
 // Codes, not arbitrary message prose, provide a bounded, stable future fallback.
 const readable=/^[A-Z][A-Z0-9_]{1,90}$/.test(code)?labelText(code.toLowerCase()):'Unspecified construction check';
 return `${readable}; ${issue?.severity==='warning'?'conditions apply':'check selection/source'}`;
}
export function coverageLabel(gap) {
 const id=typeof gap==='object'&&gap?gap.id:'';
 if(id==='metamorphic-body')return 'Metamorphic: provisional current-form support';
 if(id==='nano-mixed-medical-inventory')return 'Active package types unknown; mixed-inventory coverage incomplete';
 return id&&/^[a-z0-9_-]{1,90}$/i.test(id)?`${labelText(id)}: coverage incomplete`:'Coverage incomplete; source review required';
}
const conditionLabels = new Map([
 ['Target is smaller than a vehicle','Target smaller than vehicle only'],
 ['Parrying weapon is lower TL than the Arc-Field Weapon','Parry restriction: lower-TL weapons only'],
 ['Questioning with the Shock Whip','Shock Whip: questioning only'],
 ['Combat or intimidation use','Combat/intimidation use only'],
 ['Combat or cutting use','Combat/cutting use only'],
 ['Powered use','Powered use'],
 ['Standard shield parry only; unskilled effective Melee 0','Parry only: Melee +1; unskilled Melee 0'],
 ['Ranged attacks only; shield use unresolved','Ranged attacks only; shield use unresolved'],
 ['Fire-trait weapon attacks from the front only','Fire-trait weapon attacks from front only'],
 ['Cover behind shield; positioning and robot-size fit unresolved','Cover only; positioning/robot-size fit unresolved'],
 ['Single use; preset delay 1-12 rounds unresolved','Single use; delay 1-12 rounds unresolved'],
 ['Initial charge unspecified','Initial charge unspecified'],
 ['Host endurance reference required','Host endurance reference required'],
 ['Host endurance unresolved','Host endurance unresolved'],
 ['Uses host robot endurance','Uses host robot endurance'],
 ['Printed recharge duration','Printed recharge duration'],
 ['Recharge duration unstated','Recharge duration unstated'],
 ['Target is unaware of the attacker','Stun: target unaware of attacker only'],
 ['Parrying with the rapier','Rapier: parrying only'],
 ['Electronics (sensors) checks to detect this weapon; TL differential applies','Weapon detection only; Electronics (sensors); TL differential applies'],
 ['precise endpoint location and tracking','Precise endpoint location/tracking required'],
 ["Target is less than 50 metres away","Target under 50 m"],
 ["Compatible trigger-activated weapon targets an object within 1 metre of a correctly coded transmitting tag whose signal reaches the scanner within 50 metres","Compatible trigger; target within 1 m of coded tag; received signal within 50 m"],
 ["A sensor check made to discover this weapon","Sensor detection of this weapon only"],
 ["Authenticate before this weapon may be fired","Authentication required before firing"],
 ["Stock attached to this pistol","Stock attached to this pistol"],
 ["Using the scope on a hand-held rifle or heavy weapon","Hand-held rifle/heavy weapon scope use only"],
 ["Using the existing scope through an unshielded, non-metal barrier no thicker than the aid limit; target Protection remains","Existing scope; unshielded non-metal barrier within limit; target Protection retained"],
 ["Appropriate first aid or field surgery use; not a universal Medic modifier","First aid/field surgery only; no universal Medic modifier"],
 ["Using diagnostic information after analysis of the calibrated subject","Calibrated subject; completed diagnostic analysis only"],
 ["Extinguishing a victim subjected to a flame attack","Extinguishing flame-attack victim only"],
 ["Compatible drone and working communication link; sensory channels require corresponding target hardware. Range extension requires a separate compatible transceiver.","Compatible drone/link; sensory hardware required; range extension needs transceiver"],
 ["Swarm or drone mode, subject to compatible targets and working links; bundled expertise applies only to console operation. Swarm task complexity remains controller-limited.","Compatible target/link; console-only expertise; swarm complexity limited"],
 ["Does not include vacuum or corrosive protection. Refurbishment after protection is exhausted costs5% of robot price.","No vacuum/corrosive protection; exhausted protection: 5% refurbishment"],
 ["May repeat; additional protection stacks with the500rad baseline, counted once.","Stacks with single 500-rad baseline"],
 ["Safe depths add. Does not itself include hostile protection. Underwater non-aquatic speed halves rounded down and agility is reduced by2.","Depths add; no hostile protection; non-aquatic speed halved/rounded down; agility −2"],
 ["Laser attacks or laser communications passing through the cloud; strong wind or rain can disperse it sooner.","Laser path through cloud only; wind/rain may disperse"],
 ["Attacks against targets within the smoke cloud; infrared vision bypasses the smoke penalty. Strong wind or rain can disperse it sooner.","Targets in smoke only; infrared bypass; wind/rain may disperse"],
 ["Failed attack at or below the listed Effect","Failed attack; at/below listed Effect"],
 ["Detecting the source of this weapon sound","Weapon-sound source detection only"],
 ["All attacks with this profile","This profile: all attacks"],
 ["Using pellet ammunition","Pellet ammunition only"],
 ["Short range","Short range only"],
 ["Unstrapping and securing a backpack, when required","Backpack removal/refitting when required"],
 ["Target set on fire by this weapon","Target ignited by this weapon"],
 ["Hit a target wearing a sealed protective suit","Hit on sealed protective suit"],
 ["Firing from the deployed bipod","Deployed-bipod firing only"],
 ["Target is beyond 10 metres","Target beyond 10 m"],
 ["Target is at least 50 metres away","Target at least 50 m away"],
 ["The carrier is hit by any attack with Effect 4 or greater","Carrier hit; Effect 4+"],
 ["After using the doubled Auto score, leave the weapon to cool for two rounds","Doubled Auto: 2-round cooldown"],
 ["Anyone standing behind the launcher when it fires","Behind launcher during firing"],
 ["The target is attacked with this Smasher weapon","Attacks with this Smasher only"],
 ["Parrying with the staff held in two hands by a wielder with Melee skill","Parry: staff in two hands; Melee required"],
 ["Parrying with the buckler held in a hand by a wielder with Melee skill","Parry: held buckler; Melee required"],
 ["Living target in the cloud without a respirator or sealed suit","Living target in cloud; no respirator/sealed suit"],
 ["Thrown use only","Thrown use only"],
 ["Unshielded electronics","Unshielded electronics only"],
 ["Unshielded electronics more than two TL below the grenade","Unshielded electronics; more than 2 TL below grenade"],
 ["All electronics more than two TL above the grenade","Electronics more than 2 TL above grenade"],
 ["Target struck by the grenade","Target struck by grenade"],
 ["Attacks against targets within the cloud","Targets within cloud only"],
 ["Weapon crafted at TL0 and attack Effect is -3 or worse; manufacturing TL is not recorded by this construction.","TL0 weapon; attack Effect −3 or worse; manufacturing TL unrecorded"],
 ['Requires Remote Ops software','Requires Remote Ops software'],['Full sunlight','Full sunlight required'],
 ['Matching terrain required','Matching terrain required'],['Adaptive to terrain','Adaptive terrain'],
 ['Only the listed environmental conditions are protected; protections are not interchangeable','Listed environments only'],
 ['Peer communication link and propagation conditions still apply','Peer link/propagation conditional'],
 ['Paired tightbeam device and line of sight required','Paired device and line of sight required'],
 ['Ship-sized receiving array; larger array gains depend on receiving installation, not a universal range','Requires ship-sized receiving array'],
 ['Requires an adequately sized medical chamber; not universal species compatibility','Requires species-sized medical chamber'],
 ['Laser damage only; conventional electronic stealth ineffective except concealed-component checks','Laser protection only; electronic stealth limited'],
 ['Climbing or adhering to walls and ceilings','Wall/ceiling adhesion'],
 ['Nearby organic samples can be scanned without collection; analysis takes minutes','Organic samples; minutes per analysis'],
 ['Internal composition from gravity variations','Internal-composition scan'],
 ['Real-time neural activity and rough organism intelligence estimate, not mind reading','Neural scan; no mind reading'],
 ['Only one cleaning set operates at a time; typically 20 productive hours in 24, with replenishment and disposal separate','One active set; replenishment/disposal external'],
 ['Rated equipment capability; task conditions, materials and handling remain external','Task/materials/handling conditional'],
 ['Both ends need wireless links; brain complexity also limits tasks. No finite member count is specified','Wireless links required; brain task limits apply'],
 ['Each additional simultaneous drone reduces effective Electronics (remote ops) checks through this controller by one; both ends require transceivers','Transceivers required; simultaneous-drone penalty'],
 ['Non-corrosive water; exposed light-chassis components may be damaged at referee discretion. Submersible protection does not itself include hostile protection. Insidious pressure rating is not silently converted into extra depth','Non-corrosive water only; exposed chassis risk; protection scopes separate'],
 ['Standard chamber only; separate chambers do not combine into a larger object capacity. Full standard output needs separately provided computer-memory or data-wafer storage, not active robot skill bandwidth. Fabrication needs a separate suitable fabricator and recorded data; memory or personality restoration needs a separate compatible destination and process.','Per-chamber capacity; separate data storage; fabrication/restoration not included'],
 ['Other species need a separately established size. Space alone does not supply hibernation, medical tools, software or environmental protection','Species size unverified; tools/software/environment separate'],
 ['Only out of line of sight or protected by visilight; negates detecting Heightened Senses','Requires concealment or visilight; sense-specific'],
 ['Applies only with panels deployed.','Deployed panels only'],
 ['Stationary or minimal activity; powered-off storage does not extend radioactive lifetime.','Stationary/minimal activity; radioactive lifetime unchanged'],
 ['While in sunlight at the stated activity; solar storage history is not assumed.','Sunlight/activity required; stored energy unverified'],
]);
export function conditionLabel(value) {
 if(!value)return '';
 if(conditionLabels.has(value))return conditionLabels.get(value);
 if(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(value))return labelText(value);
 return 'Operating condition unresolved; check source';
}
const textFacts = new Map([
 ['Qualified one-handed physical configuration; no explicit printed hand count.','One-hand physical interpretation; printed hand count unstated'],
 ['Qualified two-handed physical configuration; no explicit printed hand count.','Two-hand physical interpretation; printed hand count unstated'],
 ['Selected weapon only','Selected weapon only'],
 ['Weapon computer hardware only; no robot brain bandwidth, skills or general software is installed.','Weapon computer only; no robot bandwidth/skill/software grant'],
 ['Mounting the hardware alone does not grant its hand-held Scope benefit or recipient sensors.','Hand-held Scope benefit only; no recipient sensor grant'],
 ['The prose and illustration use Anti-Materiel Rifle; the p161 table prints Anti-Material Rifle.','Printed name variant; selected source profile'],
 ['Larger weapon usable with Gun Combat; not a rifle or slug classification.','Gun Combat use; no rifle/slug classification'],
 ['Qualified physical interpretation of the full-size bows and stocked crossbows, supported by illustrations and draw/cocking descriptions.','Two-hand physical interpretation; printed hand count unresolved'],
 ['Printed Bulky, non-Destructive criterion; no archaic exclusion is stated.','Bulky, non-Destructive criterion; archaic exclusion unstated'],
 ['Additional extended-distance and simultaneous-drone modifiers are not specified by pp79/122; referee resolution remains separate','Extended-distance/simultaneous-drone modifiers unresolved; referee approval required'],
 ['One complexity-level reduction is stated; per-extra-task scaling needs source reconciliation','One complexity-level reduction; extra-task scaling unresolved'],

 ['Automatic EDU before year-end INT completion; other selected purchases are allocated by graduation','EDU before year-end INT; other purchases by graduation'],
 ['EDU is applied before year-end INT events by explicit convention; the book does not specify within-year order.','EDU before year-end INT; selected convention'],
 ['Operational game conditions only','Operational conditions only'],['Weapon sight only','Weapon sight only'],
 ['qualified-physical-interpretation','Qualified physical interpretation'],['thrown','Thrown'],['stirrup-or-windlass','Stirrup/windlass'],['lever','Lever'],
 ['As missing or improvised tools','Missing/improvised-tool penalty'],
 ['One person with vacc suit and equipment','One person; vacc suit/equipment included'],
 ['The universal ARL and beyond-10m PDW modifiers are retained separately; their interaction is not settled by construction accounting.','ARL/PDW modifier interaction unresolved'],
 ['The CSC heavy-weapon sections do not state whether an initial magazine is included. The builder separately prices one selected initial magazine as an accounting convention, not an explicit source exclusion.','Initial inclusion unstated; separate-purchase convention'],
 ['The CSC launcher entries do not state whether an initial magazine is included. The builder separately prices one selected initial magazine as an accounting convention, not an explicit source exclusion.','Initial inclusion unstated; separate-purchase convention'],
 ['Initial-load inclusion is unstated; separately purchasing the selected initial load is a construction convention, not a source exclusion.','Initial inclusion unstated; separate-purchase convention'],
 ['Initial reload inclusion is not stated; selected initial ammunition is purchased separately.','Initial inclusion unstated; separate purchase'],
 ['CSC p149 supplies laser weapons with power packs; p151 identifies the integrated heavy-rifle pack.','Initial laser pack included; integrated heavy-rifle pack'],
 ['No initial reload inclusion is stated for this cartridge or non-laser profile; one is purchased separately when selected.','Initial inclusion unstated; separate purchase'],
 ['Complete weapon includes its described cell or integral supply; no replacement purchase is specified.','Initial supply included; replacement price unresolved'],
 ['Resistance to nanotech infections while the packages remain effective','Nanotech-infection resistance only; active packages'],
 ['Resistance to nanotech infections while the typed active packages remain effective','Nanotech-infection resistance only; typed active packages'],
 ['Start of each round','Start of each round'],['Same as a slug magazine','Slug-magazine timing'],['Outside combat','Outside combat'],
 ['As if hit by this weapon','Weapon-hit damage'],['Point the carrying vehicle or aircraft','Carrier-directed aiming'],
 ['Referee decision for other chassis Sizes','Other sizes: referee approval required'],
 ['Use the detecting primary sense; do not add audible and olfactory modifiers','Primary sense only; modifiers do not stack'],
 ['Conditional detection opposition, not a universal Stealth bonus','Detection opposition only; no general Stealth grant'],
 ['TL15 duration not separately stated; TL14 1D-round duration is not assumed','TL15 duration unresolved'],
 ['Attacks at less than50m; not an unconditional attack modifier.','Under 50 m only; conditional attack modifier'],
 ['Weapon computer only; does not grant robot brain bandwidth or skill software.','Weapon computer only; no robot software grant'],
 ['Does not grant general stealth or stack Silent detection modifiers.','No general Stealth grant; Silent does not stack'],
 ['No included initial magazine stated in the CSC slug section','Initial magazine inclusion unstated'],
 ['Melee (blade)','Melee (blade)'],
 ['printed-source','Printed source'],['user-referee-ruling','User/referee ruling'],
 ['robot-endurance','Robot endurance'],['recipient-robot-endurance','Recipient robot endurance'],
 ['Intimidate','Intimidate'],['Persuade','Persuade'],
]);
const hiddenFields = new Set(['id','recordIds','weaponId','optionId','profileId','parentWeaponId','parentLimb','parentBrain','parentComputer','sourceOption','storageId','manipulatorId','supportManipulatorId','gripManipulatorIds','supplyWeaponId','ammunitionOverrides','ammunitionCopies','diagnostics','selections','design','rules','rule','tables','table','catalogue','choices','supportedTechLevels','interpretations']);
const proseFields = /^(?:description|message|notes?|detail|scope|reason|explanation|context|timing|trainingTiming|attackContext|skillScope|stacking|method|basis|costScope|.*(?:Description|Notes|Explanation|Reason|Context|Scope|Timing))$/;
const namedStrings = new Set(['label','name','speciality','specialty','subject','additionalSpecies','storage','manipulator','primaryManipulator','supportManipulator','grippingManipulators','accessory','supply','traits','coveredSpecialities','storageDestinations']);
const statusKeys = /(?:status|conditions?|resolution|fit|interpretation|qualification)$/i;
const enumKeys = new Set(['collisionSpeedBand','criticalHits','supportedPlacements','sites','limbKinds','printed','appliesTo','attackType','attackDirection','printedValue','allowedPowerSources','insufficientPowerSources','characteristics','durationUnit','purpose','nominalMedium','blockingArmour','allowedMountKinds','mechanism','triggerCompatibility','integralWeapon','sourceTableName','range','vision','atmospheres','solarOnlyGroundSpeed','includes','complexity','brainLimit','selfDamageDice','externalDamageDice','externalArmourReduction','blast','time','externalFabrication','openSpaceRangeConditions','corrosiveHours','insidiousMinutes','insidiousDays',"modes","allowed","firingModes","ignoredTraits","removedTrait","replacementTrait","damageType","nonLethalDamageType","lethalDamageType","interval","lethalExposure","weather","excludedProtection","targets","excludedBarrierMaterials","operationalApplicability","incompatibleWith","belowMinimumAttackDM","sourceDamage","priceBasis","reloadKind","sourcePrintedAuto","realism","disbeliefCheck","medium","capture","imageType","media","imageQuality","emSpectrum","lifeSignMonitoring","fuel","types","brightness","propellant","uses","removes","requiredOperatorSkill","interfaceGrade","scopeDependency","computerAccessory","programs","program","readiness","quantityScope","vehicleMountAggregation","authenticationMethodSelected","rangeBand","weaponType","profile","profiles",'kind','type','mode','skill','characteristic','sourceFamily','weaponFamily','mountClass','placement','fireControl','operatingLevel','locomotion','primary','secondary','sense','category','action','actions','tagAction','bonusRound','duration','maximumDuration','dice','trait','requiresTrait','onFailure','projectile','unrecoverableOn','breaks','refillDuration','initialMagazine','sourceInitialInclusion','sourceInclusion','priceUnit','check','location','ammunition','grenade','variant','packageType','medicalMode','role','target','effectCertification','initialMagazineType','for','unit','damage','armour','surfaces','humidity','biological']);
export function sourceReference(source) {
 if(!source)return '';
 if(typeof source==='string')return source;
 return [source.book||source.title,source.edition,source.pages!=null||source.page!=null?`p. ${source.pages??source.page}`:''].filter(Boolean).join(' · ');
}
// Facts are admitted by type and semantic field, not sentence truncation. Unknown
// strings are withheld; unknown numerical facts/statuses remain reviewable.
export function presentationFacts(value,key='') {
 if(hiddenFields.has(key)||/Ids?$/.test(key))return undefined;
 if(typeof value==='string'&&textFacts.has(value))return textFacts.get(value);
 if(proseFields.test(key))return undefined;
 if(key==='source'||key.endsWith('Source'))return sourceReference(value)||undefined;
 if(value===null||typeof value==='number'||typeof value==='boolean')return value;
 if(Array.isArray(value))return value.map(item=>presentationFacts(item,key)).filter(item=>item!==undefined);
 if(typeof value==='object'&&value){
  const entries=Object.entries(value).map(([field,item])=>[field,presentationFacts(item,field)]).filter(([,item])=>item!==undefined&&(!Array.isArray(item)||item.length));
  if(value.estimated===true)entries.push(['qualification','Source estimate']);
  if(value.refereeMayReject===true)entries.push(['approval','Referee approval required']);
  return entries.length?Object.fromEntries(entries):undefined;
 }
 if(typeof value==='string'){
  if(namedStrings.has(key))return key==='accessory'?labelText(value):value;
  if(statusKeys.test(key))return conditionLabel(value);
  if(enumKeys.has(key)&&/^[\w +(),./:*–-]{1,100}$/.test(value))return ['profiles','profile','computerAccessory','integralWeapon','includes','incompatibleWith','excludedProtection','targets','vehicleMountAggregation','operationalApplicability'].includes(key)?labelText(value.replace(/^csc-/,'')):value;
  if(/^[+-]?\d+(?:\.\d+)?(?:D(?:D|[+-]\d+)?|%|\*TL)?$/.test(value))return value;
 }
 return undefined;
}

export function diagnosticContext(issue,design,catalogue) {
 const parts=String(issue?.path||'').split('.');
 if(parts[0]==='special'&&parts[1]==='designReferences'){
  const reference=design.special?.designReferences?.find(item=>item.id===parts[2]);
  if(reference){
   const nested=parts.slice(3).join('.');
   return [reference.design?.name||'Unnamed component',nested?diagnosticContext({...issue,path:nested},reference.design,catalogue):'Component construction'].filter(Boolean).join(' · ');
  }
 }
 const controls=(catalogue.stages||[]).flatMap(stage=>(stage.controls||[]).map(control=>({...control,stage:stage.id,stageLabel:stage.label})));
 const control=controls.find(control=>parts.includes(control.field)&&(control.target==='special'?parts[0]==='special':control.stage===parts[0]));
 // A component uses its own selected records, even when its controls differ from the host.
 const field=control?.field||parts[1],values=parts[0]==='special'?design.special:design.selections?.[parts[0]],records=values?.[field];
 const index=Array.isArray(records)?records.findIndex(record=>typeof record==='object'&&record.id===parts[parts.indexOf(field)+1]):-1;
 const record=index>=0?records[index]:null;
 const choices=control?.itemFields?.find(item=>item.field==='weaponId'||item.field==='optionId')?.choices||control?.choices||[];
 let recordName='';
 if(record){
  const choice=choices.find(choice=>choice.id===(record.weaponId||record.optionId));
  recordName=record.name||choice?.label||issue.recordLabel||labelText(record.weaponId||record.optionId||field);
  recordName+=` ${index+1}`;
 }
 if(parts[0]==='special'&&parts.includes('weapons')){
  const weaponIndex=(design.special?.augmentWeapons||[]).findIndex(item=>parts.includes(item.id));
  if(weaponIndex>=0){
   const weapon=design.special.augmentWeapons[weaponIndex];
   const weaponChoices=controls.find(item=>item.field==='augmentWeapons')?.itemFields?.find(item=>item.field==='weaponId')?.choices||[];
   recordName+=" / "+(weaponChoices.find(item=>item.id===weapon.weaponId)?.label||labelText(weapon.weaponId))+' '+(weaponIndex+1);
  }
 }
 const storage=parts.find(part=>part.startsWith('instance:')||part.startsWith('option:'));
 if(storage){
  const [kind,id]=storage.split(':');
  const instances=design.selections?.physical?.optionInstances||design.special?.augmentOptions||[];
  const item=kind==='instance'?instances.find(item=>item.id===id):null;
  const optionId=item?.optionId||(kind==='option'?id:null);
  const choice=controls.flatMap(item=>item.choices||[]).find(choice=>choice.id===optionId);
  recordName=optionId?(choice?.label||labelText(optionId))+(item?` ${instances.indexOf(item)+1}`:''):'Unresolved storage';
 }
 const option=controls.flatMap(item=>item.choices||[]).find(choice=>parts.includes(choice.id));
 const copyIndex=parts.indexOf('ammunitionOverrides');
 return [...new Set([control?.stageLabel,control?.label||issue.contextLabel||(!control&&record?labelText(field):''),recordName||option?.label,copyIndex>=0&&/^\d+$/.test(parts[copyIndex+1])?`Copy ${parts[copyIndex+1]}`:''].filter(Boolean))].join(' · ');
}

export function sourceExampleLabel(example) {
 const labels={
  startek:'Published TL14; printed Cr697,100; calculated Cr697,300; initial power pack Cr200',
  'steward-droid':'Published construction Cr39,800; discretionary list price Cr35,000',
  'inspection-platform':'Authored TL12 example; not a published robot',
 };
 return labels[example?.id]||(example?'Example; source qualification unreviewed':'');
}
