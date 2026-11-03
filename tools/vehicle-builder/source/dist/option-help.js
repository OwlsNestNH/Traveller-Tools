/* Presentation copy from the existing catalogue traits and construction rules.
   This module describes choices; it never changes construction calculations. */
(function(root){
'use strict';
const purposes={
Autopilot:'Automates piloting so the vehicle can follow its programmed course.',
Transceiver:'Provides two-way radio communication over the selected range.',
'Meson Communicator':'Provides meson-based communication over the selected range.',
'Navigation System':'Helps the crew navigate and find their route.',
'Sensor System':'Detects and tracks nearby targets using the selected sensor grade.',
'Underwater sensors':'Detects and tracks targets underwater; its range differs from the equivalent surface sensor.',
Camouflage:'Makes the vehicle harder to spot visually.',
'Holographic Hull':'Uses a projected appearance to disguise the vehicle.',
Reflec:'Protects against laser fire, but makes the vehicle easier to detect.',
Stealth:'Reduces the vehicle’s signature to sensors.',
Computer:'Provides computing bandwidth for vehicle software.',
'Ship Computer':'Provides spacecraft-grade computing bandwidth for installed software.',
'Ship Core':'Provides higher-capacity spacecraft computing for installed software.',
'Drone Actuators':'Allows a drone interface to operate the vehicle’s physical controls.',
'Vehicle Brain Interface':'Allows a vehicle brain to control the vehicle through a haptic interface.',
'Battle Network':'Connects participating vehicles through a tactical network.',
'Drone Control':'Provides software for remotely controlling a drone.',
'HPI Holographic Display':'Provides a custom holographic interface for the operator.',
'HPI Multi-chromatic Display':'Provides a custom multi-colour interface for the operator.',
'Point Defence':'Provides software support for defending against nearby incoming attacks.',
'Salvo Solution':'Provides fire-solution software for this vehicle’s salvo attacks.',
Sensop:'Provides software for operating the vehicle’s sensors.',
'Swarm Control':'Coordinates several drones within the selected task and skill limits.',
'Tactical Battle System':'Provides software assistance for military tactics checks.',
Weaponry:'Provides software for controlling the vehicle’s weapons.',
Intellect:'Provides an improved software agent that can use Expert systems.',
'Drone Interface':'Connects drone-control software to the vehicle’s control hardware.',
Chauffeur:'Provides a vehicle brain intended for driving duties.',
'Combat Vehicle Brain':'Provides a vehicle brain with the listed combat and navigation skills.',
'Tour Guide':'Provides a vehicle brain with the listed guiding and passenger-service skills.',
'Sub Control Brain':'Provides a vehicle brain with the listed navigation and sensor skills.',
ECM:'Provides electronic countermeasures against hostile detection and targeting.',
'Aquatic Internal Environment':'Fills the interior with water to accommodate aquatic occupants.',
'Corrosive Environment Protection':'Protects the vehicle in corrosive atmospheres.',
'Heat Shielding':'Protects the vehicle against extreme external heat.',
'High Pressure Protection':'Increases the pressure the vehicle can withstand.',
'Hostile Environment Protection':'Protects the vehicle against the listed hostile atmospheric, radiation and water conditions.',
'Insidious Environment Protection':'Protects the vehicle in insidious atmospheres.',
'Pressurised Hull':'Maintains a protected interior in very thin or tainted atmospheres.',
'Radiation Protection':'Increases the vehicle’s protection against radiation.',
'Self-Cleaning Hull':'Keeps mud and dirt from accumulating on the hull.',
'Self-Repairing Hull':'Repairs limited non-critical Hull damage over time.',
'Self-Sealing Hull':'Seals hull breaches and includes the listed cleaning and fuel-tank protection.',
'Vacuum Environment Protection':'Protects the vehicle in vacuum and trace atmospheres.',
'Simple Coupler':'Links the vehicle to another vehicle fitted with a compatible coupler.',
'Vestibule Coupler':'Links vehicles while maintaining their internal environment.',
'Docking Hatch':'Provides an airtight connection between vehicles.',
'Docking Clamp':'Secures another vehicle within the selected capacity.',
'Tow Hitch':'Provides the connector, cables and hooks needed to tow another vehicle.',
Winch:'Pulls or recovers a load using a cable.',
'Climbing Wheels':'Lets a wheeled vehicle climb steeper slopes.',
'Gecko Grippers':'Lets a small vehicle move along walls and ceilings at Idle speed.',
'Manipulator Arm':'Provides an external arm for handling objects.',
'Heavy Manipulator Arm':'Provides a stronger external arm whose characteristics depend on the vehicle.',
'Robot Manipulator Arm':'Provides a configurable robot arm with separately selected Size, strength and dexterity.',
'Cargo Mount':'Carries cargo externally instead of inside the vehicle.',
Crane:'Lifts cargo up to the selected crane’s load limit.',
Convertible:'Allows the vehicle to convert to an open top.',
'Cutting Tool':'Fits a tool for cutting through material.',
'Digger Blade':'Moves earth and loads material using a front blade.',
'Drill Rig':'Drills into the ground to the listed depth and rate.',
'External Sampler':'Collects and analyses one selected class of gas, liquid or solid sample.',
'Ground Penetrating Radar':'Looks for anomalies beneath the ground.',
'Landing Deck':'Provides deck space and equipment for aircraft landings.',
Tailhook:'Equips an aeroplane for arrested landings on a suitable landing deck.',
'Launch Deck':'Provides deck space and equipment for launching aircraft.',
'Outboard Motor':'Provides a small additional motor for moving a watercraft.',
Ram:'Reinforces the vehicle for ramming attacks.',
'Refuelling Plant':'Provides equipment for refuelling the vehicle.',
'Tyre Chains':'Temporarily improves off-road traction at the listed speed cost.',
'Vehicle Parachute':'Lets the vehicle descend by parachute within the listed deployment limits.',
'Wheel Tracks':'Adds temporary tracks for rough terrain at the listed speed cost.',
'Acoustical Camouflage':'Makes the vehicle harder to detect by sound.',
'Acoustical Sensor':'Detects targets by sound over the listed range.',
'Chemical Camouflage':'Makes the vehicle harder to detect by chemical traces.',
'Chemical Sensor':'Detects chemical traces over the listed range.',
Densitometer:'Scans the density of objects to help identify what is inside them.',
'Decoy Dispenser':'Deploys decoys to distract suitable guided weapons.',
'Electrostatic Armour':'Provides active protection against the listed projectile attacks.',
'Meson Screen':'Provides defensive protection against meson attacks.',
NAS:'Detects and analyses neural activity over the listed range.',
'Nuclear Damper':'Attempts to prevent nuclear detonation within its operating range.',
'Prismatic Aerosol Discharger':'Deploys an aerosol cloud that reduces incoming laser damage.',
'Reactive Armour':'Provides additional protection that is depleted by hits.',
'Recon Sensor':'Provides the listed Recon capability for observing the surroundings.',
'Smoke Discharger':'Deploys smoke to obstruct visual targeting.',
'Air Lock':'Allows people and equipment to enter or leave while maintaining the interior environment.',
Biosphere:'Supplements life support with a natural environment for the allocated people.',
'Clean Room':'Provides a low-particulate workspace.',
'Collision Protection':'Adds protection for the allocated interior Spaces during collisions.',
'Grav Plating':'Changes gravity inside the vehicle.',
'Inertial Compensator':'Reduces the acceleration experienced inside the vehicle.',
'Life Support':'Supplies a habitable environment for the allocated number of people.',
'Life Support Seat':'Provides short-term life support for one seated occupant.',
Autodoc:'Provides automated diagnosis, medication and surgery at the listed Medic capability.',
Bunk:'Provides stacked sleeping accommodation and limited personal storage.',
'Common Space':'Adds shared room for occupants and a basis for luxury interior fittings.',
Cryoberth:'Rapidly freezes an injured patient for preservation.',
'Ejection Cocoon':'Protects an ejecting occupant at high speed or in a hostile environment.',
'Ejection Seat':'Launches an occupant clear of a damaged vehicle.',
'Entertainment System':'Adds entertainment facilities and the corresponding comfort contribution.',
'Fire Extinguishers':'Provides fire-suppression equipment for the vehicle.',
Fresher:'Provides a toilet and washing facilities.',
Galley:'Provides facilities for preparing food.',
'Holographic projector':'Projects a moving holographic image within the listed volume.',
'Low Berth':'Freezes a patient for preservation at the listed rate.',
'Luxury Exterior':'Adds an exterior finish expressing the selected social status.',
'Luxury Interior Space':'Adds luxury furnishings to allocated interior Spaces.',
'Sleeping Berth':'Provides one person with a sleeping place and personal storage.',
Stateroom:'Provides basic private accommodation for one person.',
'Ammunition Storage Space':'Reserves general ammunition storage; mount-specific reserves are handled separately.',
Armoury:'Provides secure storage for weapons and armour.',
Brig:'Provides secure prisoner accommodation.',
'Command Centre':'Provides a command workspace and seats for coordinating others.',
'Command Centre extra seat':'Adds another seat to an existing command centre.',
'Laboratory: Primitive':'Provides a basic workspace for science tasks.',
'Laboratory: General':'Provides a general laboratory that can use the vehicle’s equipment.',
'Laboratory: Specialised':'Provides a laboratory focused on the selected scientific work.',
Library:'Provides reference material to support learning and training.',
'Medical Bay: Bed':'Provides a patient bed for recovery and administering medicine.',
'Medical Bay: Cabinet':'Provides storage for medical equipment and supplies.',
'Medical Bay: Operating Table':'Provides a workspace for surgery.',
'Medical Bay: Sterile':'Makes allocated medical-bay Spaces sterile.',
'Multi-Environment Enclosure':'Reserves an enclosure for controlled temperature, humidity or water conditions.',
'Multi-Environment Equipment':'Equips a multi-environment enclosure to maintain its chosen conditions.',
'Recreational: Common Area Space':'Provides common or open space for recreation.',
'Recreational: Garden Space':'Provides a planted space for food or comfort.',
'Recreational: Park Space':'Provides maintained parkland for recreation.',
'Recreational: Venue':'Provides space for arts, sports or public recreation.',
'Self-Sealing Fuel Tank':'Reduces the severity of fuel critical hits.',
'Training Facility':'Provides a dedicated facility to support training.',
'UNREP System':'Transfers material between vehicles using the listed capacity.',
'Vault Space':'Provides a secure compartment with the listed lock and protection.',
'Vault Life Support':'Adds short-term life support and environmental protection to a vault.',
'Vault Reinforced Armour':'Increases the protection of a vault.',
Workshop:'Provides a mechanic with a dedicated workspace and equipment.',
'Workshop Space':'Expands an existing workshop without adding another mechanic’s station.',
'Drone Control Console':'Provides an operator console for controlling drones.',
'Swarm Control Console':'Provides an operator console for coordinating a drone swarm.',
'Fire Director System':'Provides targeting coordination for a weapon battery.',
'Construction Bay':'Reserves a bay for building vehicles within the allocated capacity.',
Excavation:'Records the excavation needed to fit the enclosed structure or vehicle.',
Machinery:'Provides machinery for the selected industrial process.',
'Mineral Refinery':'Processes mineral input into refined output.',
Smelter:'Processes refined ore into the listed industrial output.',
'Agricultural Zone: Traditional Farming':'Reserves growing space for traditional farming.',
'Agricultural Zone: Industrial Farming':'Reserves growing space for industrial farming.',
'Agricultural Zone: Scientific Farming':'Reserves growing space for scientific farming.',
'Agricultural Zone: Hydroponics':'Reserves growing space for hydroponic food production.',
'Zone: Commercial':'Reserves space for commercial activity.',
'Power: Chemical':'Provides a chemical power plant for a specialist installation.',
'Power: Fission':'Provides a fission power plant for a specialist installation.',
'Power: Fusion':'Provides a fusion power plant for a specialist installation.',
'Power: Fusion+':'Provides a fusion-plus power plant for a specialist installation.',
'Power: Geothermal':'Provides power from a geothermal source.',
'Power: Hydroelectric':'Provides power from flowing water.',
'Power: Solar':'Provides power from a solar source.',
'Power: Wind':'Provides power from a wind source.',
'Power Plant Fuel Tank':'Reserves fuel for a specialist power plant.',
'Industrial Drone':'Provides a drone to perform the listed industrial labour.',
'Industrial Drone Control Robot':'Provides a robot to coordinate industrial drones.',
'Industrial Robot':'Provides a robot to perform the listed industrial labour.',
'Internal Fabrication Chamber':'Fabricates mechanical items within the listed technology and production limits.',
'Agricultural Manufacturing':'Reserves space for agricultural production.',
'Services Space':'Reserves space for services rather than physical production.',
'Speciality Manufacturing':'Reserves space for the selected specialised manufacturing process.',
'Standard Manufacturing':'Reserves space for standard manufacturing output.',
'Long Range Transceiver':'Provides radio communication across the selected long range.',
'Long Range Transceiver · tightbeam':'Provides directional long-range communication.',
'Transceiver Encryption':'Encrypts radio communications; communicating parties need compatible modules.',
'Satellite Uplink':'Connects a suitable radio to an orbiting satellite or spacecraft.',
'Transceiver Tightbeam':'Adds directional laser or maser communication that requires line of sight.',
'Docking Bay':'Carries a vehicle in a compartment fitted to its shape.',
'Hangar Bay':'Carries a vehicle with room for maintenance and deployment.',
'Drone Control Helmet':'Provides a wearable drone-control interface and its integrated radio.',
'Auxiliary Fuel Tank':'Adds external reserve fuel on a hardpoint instead of using internal cargo space.'
};
const n=v=>Number(v).toLocaleString('en-US',{maximumFractionDigits:2});
function system(o,F,U){
 const family=U.family(o.Name),purpose=purposes[family];
 if(!purpose)throw Error('Missing option explanation: '+family);
 const lines=[purpose],trait=String(o.Traits??'').trim();
 if(family==='Sensor System')lines.push('Listed base detection range: '+n(o.Traits)+' km.');
 else if(trait&&trait!==o.Name&&family!=='Stealth'){const prefix=family==='Autopilot'?'Listed piloting modifier':family==='Navigation System'?'Listed navigation modifier':family==='ECM'?'Listed ECM rating':'Selected specification';lines.push(prefix+': '+trait.replace(/[.]$/,'')+'.');}
 if(o._prototypeBase)lines.push((o._prototypeEarly?'Early prototype':'Prototype')+': available earlier than '+o._prototypeBase+' at increased cost and volume.');
 if(o._fibreBase&&!trait.includes('Fibre-optic'))lines.push('Fibre-optic protection against EMP, radiation and ion weapons.');
 if(family==='Life Support')lines.push('Quantity is people supported; suitable hull sealing is required.');
 if(family==='Tow Hitch')lines.push('Quantity is powered towed Spaces; unpowered towed capacity is twice that amount.');
 if(family==='Satellite Uplink')lines.push('Requires a radio with at least 500 km range; uses no Spaces from TL8.');
 if(family==='Transceiver Encryption')lines.push('Cost remains Cr4,000 at higher TLs.');
 if(F.category(o)==='Specialist & spacecraft')lines.push('The builder budgets construction; specialist operation, staffing and compatibility require review.');
 lines.push('Minimum TL'+o.TL+'.'+(o.Powered==='P'?' Requires vehicle power.':''));
 return lines;
}
function selection(key,value,F){
 let row,pages,lines=[];const v=String(value),unknown=()=>({lines:['This saved selection is not in the current reference data. Choose a listed option and check the construction warnings.']});
 if(key==='type'){
  row=F.types.find(x=>x.Type===v);if(!row)return unknown();const purpose={Aeroplane:'A winged aircraft for atmospheric flight.',Airship:'A lighter-than-air craft supported by its lifting envelope.','Grav Vehicle':'A vehicle using gravitic lift.','Ground Vehicle':'A ground-going chassis for wheeled or tracked designs.',Hovercraft:'A vehicle supported above a surface by an air cushion.',Rotorcraft:'An aircraft supported by rotors.',Structure:'A stationary installation rather than a mobile vehicle.',Submersible:'A vehicle built to operate below the water’s surface.',Walker:'A vehicle supported and moved by legs.',Watercraft:'A vehicle built to travel on water.'};lines=[purpose[v],`Sets the chassis baseline: Cr${n(row.Cost)} and ${n(row.Hull)} Hull per nominal Space; operating skill ${row.Skill}. Minimum TL${row.TL}.`];
 }else if(key==='power'||key==='secondary'){
  pages='44-48';if(v==='none')lines=['No secondary power system is installed.'];else{
   row=F.powers.find(x=>x.Power===v);if(!row)return unknown();let purpose=v==='Powered'?'Uses the standard powered drivetrain.':v==='Unpowered'?(key==='secondary'?'Provides no powered secondary drive; construction checks determine whether this entry is allowed.':'Removes powered propulsion; motion depends on an external source.'):v==='Wind'?'Uses wind for propulsion.':v==='Muscle'?'Uses muscle power for propulsion.':v==='Grid Power'?'Draws power from an external grid.':v==='Beamed Power'?'Receives power transmitted from an external source.':v.startsWith('Fission')?'Uses a fission reactor as the power source.':v.startsWith('Fusion+')?'Uses the selected fusion-plus plant.':v.startsWith('Fusion')?'Uses the selected fusion reactor.':v.startsWith('Solar')?'Uses solar panels as the power source.':'Uses an antimatter power plant.';
   lines=[purpose,`Minimum TL${row.TL}. Plant volume and minimum size depend on whether it is primary or secondary.`];if(v.startsWith('Fission'))lines.push('Requires Hostile Environment Protection.');if(row.Prohibited&&row.Prohibited!=='none')lines.push('Not allowed on: '+row.Prohibited+'.');
  }
 }else if(key==='hull'){
  pages='55-56';lines=[({Standard:'Keeps the normal chassis Hull and baseline cost.',Reinforced:'Strengthens the hull: adds 10% Hull, rounded to the nearest point with a minimum of one, and adds 50% of baseline chassis cost.',Light:'Lightens the hull: removes 25% Hull, rounded to the nearest point with a minimum of one, and saves 25% of baseline chassis cost.'})[v],'This changes Hull rather than armour points. One-Space vehicles cannot use reinforced or light hulls. Structure is calculated separately from Hull.'];
 }else if(key==='gas'){
  row=F.D.BuoyancyGas.find(x=>x['Buoyancy Gas']===v);if(!row)return unknown();lines=[({ 'Hot Air':'Uses heated air to provide buoyancy.',Helium:'Uses helium to provide buoyancy.',Hydrogen:'Uses hydrogen to provide buoyancy.',Vacuum:'Uses evacuated cells to provide buoyancy; requires a Rigid airship.'})[v],`Minimum TL${row.TL}. ${n(row['Spaces Available']*100)}% of nominal envelope Spaces are available for the vehicle’s fittings.`];
 }else if(key==='aux'){
  pages='50-54';if(v==='none')lines=['No auxiliary drive is installed in this slot.'];else{row=F.D.Secondary.find(x=>x.Secondary===v);if(!row)return unknown();lines=[`Adds a separate ${v.toLowerCase()} for ${row.Terrain.toLowerCase()} operation.`,`Minimum TL${row.TL}. Uses its own auxiliary performance; primary-drive upgrades do not improve it.`];if(v.startsWith('Rocket'))lines.push('Includes one round of thrust; trajectory and flight planning require review.');}
 }else if(key==='rail'){
  row=F.D.RailNetwork.find(x=>x['Rail Network']===v);lines=['Selects the rail infrastructure used by a Rail Rider design.'];if(v.includes('Maglev'))lines.push('Magnetic-levitation rail requires Grid Power.');else if(v.includes('Gravlev'))lines.push('Gravitic rail requires Grid Power and Lifters.');else lines.push('Uses the selected conventional rail grade.');pages='40';
 }else if(key==='sophont'){
  pages='24-27';lines=[`Scales accommodation for occupants ${n(value)} times the human-sized baseline.`,`The multiplier changes crew and passenger Space requirements; each accommodation group rounds up separately.`];
 }else if(key==='ruling'){
  pages='32, 45';lines=[v==='prose'?'Uses the handbook’s prose allowance of 25% for a powered structure.':'Uses the handbook table/worksheet allowance of 30% for a powered structure.','The source disagreement is kept explicit; this selection chooses which existing ruling the builder applies.'];
 }else if(key==='control'){
  row=F.options.find(x=>x.Name===v);if(!row)return unknown();lines=['Provides the interface used to drive or operate the vehicle.',`Agility ${row.Bonus>=0?'+':''}${row.Bonus}; minimum TL${row.TL}.`];if(v.includes('primitive'))lines.push('Primitive controls apply their listed control penalty and cost adjustment.');else if(v.includes('basic'))lines.push('Basic controls are included in the chassis; no improved-control Agility bonus is added.');else lines.push('An improved grade requires power and adds the listed Agility benefit; more control stations do not stack that benefit.');
 }else if(key==='mount'){
  row=F.D.Mounts.find(x=>x['Weapon Mount']===v);if(!row)return unknown();lines=[({ 'Fixed Mount':'Holds a weapon at a fixed aim point.',Hardpoint:'Carries an externally mounted weapon.', 'Pintle Mount':'Supports a weapon aimed within its specified arc.','Ring Mount':'Supports a weapon that can cover any arc.',Gunport:'Provides a firing opening for a weapon operated from inside.',Bay:'Houses weapons in a bay; one weapon can be fired per round.','Multi-Bay':'Houses multiple weapons that can be fired in the same round.',Turret:'Places weapons in a turret with crew space included in the mount.'})[v]];if(row['Pop-up']==='N')lines.push('This mount cannot be made pop-up.');
 }else if(key==='facing'){
  pages='101-105';lines=[`Assigns this mount to the ${v.toLowerCase()} face of the vehicle.`,'Facing records the mount’s firing direction; the mount’s arc restrictions still apply.'];
 }else if(key==='fireControl'){
  row=F.D.FireControl.find(x=>x['Fire Control System']===v);if(!row)return unknown();lines=[v==='none'?'Fits no additional fire-control system.':v==='Scope'?'Adds an aiming scope to the weapon mount.':'Adds targeting assistance to the weapon mount.',`Listed attack modifier ${row.DM>=0?'+':''}${row.DM}; minimum TL${row.TL}; Cr${n(row.Cost)} per system.`];
 }else if(key==='ammoType'){
  const a=F.ammunition.find(x=>x.name===v);if(!a)return unknown();pages='120-123';lines=['Selects the type of purchased reserve ammunition.',a.effect+`. Minimum TL${a.tl}; reserve ammunition cost multiplier ×${a.multiplier}.`,'Applies to purchased reloads; does not replace the weapon’s displayed base statistics. Calibre and compatibility require review.'];
 }else if(key==='weapon'){
  row=F.weapons.find(x=>x.Weapon===v);if(!row)return unknown();lines=[row._empty?'Reserves mount capacity without fitting a weapon.':row._personal?'Records a personal weapon fired through a gunport; the occupant supplies the weapon.':v.startsWith('Anti-Missile System')?'Fits a self-contained automated anti-missile turret with its mount, sensors and fire control.':'Fits the selected weapon in this mount.',`Listed damage ${row.Damage}; range ${n(row.Rangekm)} km; weapon mass ${n(row.Tons*1000)} kg.`,row.Traits?String(row.Traits):'No additional catalogue traits listed.'];
 }else if(key==='rangeBoost'){
  pages='60';lines=[`Multiplies this sensor’s detection range by ${10**Number(value)}.`,`The selected multiplier changes the sensor’s budget; effective range is shown beside its controls.`];
 }else{
  const copy={drone:'Makes the design remotely operated; remote operation still needs compatible controls and interfaces.',vacTube:'Selects a vacuum-tube rail network; TL8 is required.',remote:'Locates the gunner outside the weapon mount; their accommodation is budgeted separately.',autoloader:'Adds automatic loading equipment; TL6 or higher is required.',popup:'Lets a compatible weapon mount retract into the vehicle.',modular:'Makes the weapon mount a removable module.',highFidelity:'Improves sensor detail and fidelity with the listed +1 DM; TL6 is required.',hardened:'Hardens sensors against the listed DM−1 jamming penalty; TL7 is required.',mast:'Raises the sensor on a mast.'};
  if(copy[key]){pages=['highFidelity','hardened','mast'].includes(key)?'60':['remote','autoloader','popup','modular'].includes(key)?'101-105':key==='vacTube'?'40':'94-96';lines=[copy[key],value?'Currently fitted/enabled.':'Currently not fitted/enabled.'];}
 }
 return {lines:lines.filter(Boolean),row,pages};
}
const featurePurposes={
 Aerodyne:'Uses jet propulsion in a wingless flying design.',AFV:'Builds an armoured fighting vehicle with a stronger hull and greater armour allowance.',Agile:'Tunes the steering and locomotion to make the vehicle easier to handle.',ATV:'Adapts the vehicle for all-terrain travel.',Fast:'Uses a larger engine, trading fuel range for speed.',Floats:'Adds flotation so an aircraft can land on water.','Folding Wings':'Folds wings or rotors to make the aircraft easier to ship.',Hydrofoil:'Lifts a moving watercraft above the water to reduce drag.',Hypersonic:'Equips a jet aeroplane for hypersonic flight.','Jet Engines':'Replaces propeller propulsion with jet engines.',Locomotive:'Optimises a powered vehicle for hauling other vehicles.',Monowheel:'Uses one driving wheel for a compact, manoeuvrable vehicle.','Multi-Legged':'Gives a walker more than two legs for handling rough ground.','Off-Roader':'Adapts the vehicle for travelling away from roads.','Open Frame':'Places riders outside the enclosed body of the vehicle.','Open-Topped':'Leaves the vehicle open above its occupants.',Ornithopter:'Uses flapping wings to fly like a bird.','Rail Rider':'Fits the vehicle to run on railway tracks or a monorail.',Responsive:'Makes acceleration and deceleration quicker.',Rigid:'Gives an airship a rigid supporting frame.',Slow:'Uses a smaller engine, trading speed for more fuel range.','Smart Wheels':'Adapts wheel traction to difficult ground conditions.',STOL:'Equips an aircraft for short take-offs and landings.',Streamlined:'Shapes the body to reduce aerodynamic drag.',Supersonic:'Equips a jet aeroplane for supersonic flight.','Tilt Engines':'Tilts an aeroplane’s engines for vertical take-off and landing.',Tracks:'Uses tracks to cross rough ground.',Tunneller:'Equips a ground vehicle to tunnel through rock.',Unresponsive:'Trades quick speed changes for a cheaper chassis.'
};
function feature(name,F,state){
 const f=F.features.find(x=>x['Feature Effect']===name);
 if(!f)return ['This saved feature is not in the construction catalogue. Remove it or choose a supported feature.'];
 const effects=[],limits=['Minimum TL'+f.TL],sign=x=>(x>0?'+':'')+n(x);
 if(f.Agility)effects.push('Agility '+sign(f.Agility)+'.');
 if(name==='Supersonic')effects.push('Sets base speed to Supersonic (band 9).');
 else if(name==='Hypersonic')effects.push('Sets base speed to Hypersonic (band 10), or band 11 with Fast.');
 else if(f.Speed)effects.push('Speed '+sign(f.Speed)+' band'+(Math.abs(f.Speed)===1?'':'s')+'.');else effects.push('Top speed unchanged.');
 if(f.RangeMod!==1)effects.push(f.RangeMod===.5?'Range is halved.':'Range '+n(Math.abs(f.RangeMod-1)*100)+'% '+(f.RangeMod>1?'greater.':'shorter.'));else effects.push('Range unchanged.');
 effects.push('Internal Spaces: no added allocation.');
 if(f.HullMod!==1)effects.push('Hull +'+n((f.HullMod-1)*100)+'%.');
 if(f.ShippingMod!==1)effects.push(f.ShippingMod===.5?'Shipping volume is halved.':'Shipping volume ×'+n(f.ShippingMod)+'.');
 const special={AFV:'Armour limit is tripled; AFV and Tracks together share one speed-band penalty.',ATV:'Removes the off-road travel penalty and allows Rough terrain.','Off-Roader':'Removes the off-road travel penalty and allows Rough terrain.',Locomotive:'Towing capacity ×4 and reactor Power output ×3; gains the Unresponsive trait.',Monowheel:'Port and starboard armour must remain zero.','Multi-Legged':'DM+1 on rough terrain.','Open Frame':'Riders have no armour protection; enclosed-environment equipment is restricted.','Open-Topped':'Dorsal armour must remain zero; the sides provide half cover. Enclosed-environment equipment is restricted.',Ornithopter:'Requires Flyer (ornithopter) to pilot.',Responsive:'Halves the time needed to change speed bands.',Unresponsive:'Doubles the time needed to change speed bands.','Smart Wheels':'DM+1 in adverse conditions and reduces the terrain penalty by 1.',STOL:'Halves the runway space needed for take-off and landing.','Tilt Engines':'Provides vertical take-off and landing (VTOL).',Tracks:'AFV and Tracks together share one speed-band penalty.',Tunneller:'Tunnels at TL metres per hour, doubled from TL8.'};
 if(special[name])effects.push(special[name]);
 if(name==='Streamlined'&&state.type==='Airship')effects.push('Adds one percentage point of nominal envelope Spaces to usable airship capacity.');
 const chassis=F.types.find(t=>t.Type===state.type),featureCost=chassis?Math.abs(chassis.Cost*state.spaces*f['Cost add']):null;
 effects.push((f['Cost add']<0?'Saves ':'Adds ')+n(Math.abs(f['Cost add'])*100)+'% of baseline chassis cost'+(featureCost!==null?' (Cr'+n(featureCost)+' on this chassis)':'')+'.');
 if(f['Size Limit']!=='none')limits.push(f['Size Limit']==='Size 20+'?'at least 20 nominal Spaces':'1–3 nominal Spaces only');
 if(f.Prerequisite==='Powered')limits.push('requires vehicle power');
 if(f.Prerequisite==='Jet')limits.push('requires Jet Engines');
 let conflicts=String(f.Incompatible).split(',').map(x=>x.trim().replace('Open Topped','Open-Topped').replace('Tracked','Tracks')).filter(x=>x&&x!=='none');
 if(name==='Tracks'&&!conflicts.includes('Rail Rider'))conflicts.push('Rail Rider');
 if(conflicts.length)limits.push('incompatible with '+conflicts.join(', '));
 if(name==='Unresponsive')limits.push('no duplicate discount when already Unresponsive from size (200+ Spaces)');
 const reasons=F.featureReasons(name,state);
 return [featurePurposes[name],'When fitted: '+effects.join(' '),'Limits: '+limits.join('; ')+'.','Current choice: '+(state.features.includes(name)?'Fitted.':'Not fitted. Effects apply only when fitted.'),...(reasons.length?['Current restrictions: '+reasons.join('; ')+'.']:[])];
}
function input(key,context={}){
 const copy={
 comfort:['Explains the overall average comfort for this design; it is not the worst group’s seat comfort.','The builder divides budgeted crew/passenger accommodation Spaces plus equipment Comfort Points by the occupant-size multiplier and total occupant count. Separate seating groups keep their own seat-allocation labels.','24-27, 83-85, 100'],
 description:['Records free-form notes about this vehicle.','Notes are included in JSON saves and the printed record; they do not change the construction calculations.',null],
 tl:['Sets the vehicle’s technology level, which limits which components and feature grades can be fitted.','Use a whole number from 0 to 20; incompatible existing selections are flagged rather than silently removed.','27'],
 spaces:['Sets the nominal size of the chassis in whole Spaces.','This sets baseline cost and capacity; one cargo Space holds 250 kg. Equipment and occupants consume the available capacity.','25-27'],
 extraPower:['Adds reactor volume to the primary nuclear power plant.','Each extra Space costs and produces Power according to that plant’s rating; it cannot extend a non-nuclear primary plant.','44-48'],
 speedMod:['Raises or lowers the vehicle’s speed by whole speed bands.','Faster steps cost chassis money and usable Spaces; Slower steps release Spaces. TL limits and maximum speeds still apply.','49'],
 efficiency:['Changes how far the vehicle travels on its fuel.','Each positive step adds 50% range; each negative step removes 25%. The chassis cost changes, and TL limits apply.','50'],
 fuel:['Changes the amount of fuel carried.','Each step adds or removes 25% range and changes fuel-tank Spaces. At most two reductions are allowed; conventional or Fusion+ primary power is required.','50'],
 armour:['Adds armour protection above the chassis’s base armour.','Four side faces receive full added armour; dorsal and ventral receive half, rounded up. Armour consumes Spaces and money and must stay within the armour limit.','26, 55-56'],
 depth:['Multiplies a submersible’s safe operating depth.','Each additional multiplier adds 100% of baseline chassis cost and +1 base armour. The resulting armour must stay within its limit.','33'],
 crew:['Allocates crew members, including the driver and any required operators.','Crew accommodation consumes Spaces; weapon crews and remote gunners are checked against the design’s needs.','24-27, 101-105'],
 passengers:['Sets the passenger count in the main seating group.','Do not include crew here. This group’s seating is budgeted separately from additional passenger groups.','24-27'],
 crewSpace:['Sets the amount of accommodation allocated per crew member.','Less than one Space per human-sized person reduces comfort. Occupant size also applies, and each group’s installed Spaces round up.','24-27'],
 passengerSpace:['Sets accommodation per passenger in the main group.','The allocation controls seating comfort and Space use. Occupant size also applies, and each group rounds up separately.','24-27'],
 controlQuantity:['Sets how many control stations are installed.','Paid stations are charged per station; the primitive-control price adjustment applies once. The control system’s Agility modifier never stacks with more stations.','58'],
 cargo:['Reserves internal Spaces for cargo.','Each Space holds 250 kg. Cargo competes with occupants and installed equipment for the same usable capacity.','27'],
 'group.name':['Names this additional passenger group so different seating arrangements can be distinguished.','This label is saved with the design; it does not change the calculations.',null],
 'group.count':['Sets the number of passengers using this additional seating arrangement.','Keep these passengers separate from the main group and crew. Each group’s seating Spaces round up independently.','24-27'],
 'group.space':['Sets accommodation per passenger in this additional seating group.','This controls that group’s comfort and Space use; occupant size applies. Fold-down seats receive no automatic cargo-space credit.','24-27'],
 'weapon.quantity':['Sets how many identical weapons are linked in this mount.','Weapon mass, cost, crew and ammunition requirements scale with the count. Linked damage adds +1 per damage die per extra weapon before the Destructive multiplier.','101-105'],
 'weapon.ammo':['Purchases extra reload rounds for this mount.','Reserve ammunition adds cost and storage Spaces using the chosen ammunition profile. It does not change the weapon’s displayed base damage.','102, 120-123'],
 'weapon.gunShield':['Adds a protective shield for the mount’s gunner.','Enter the shield’s Protection value; the builder budgets the shield and checks its limits. It is separate from overall hull armour.','103'],
 'weapon.loaders':['Assigns people to reload this weapon without an autoloader.','Each missing required loader doubles reload time. An unassigned loader does not reserve a berth automatically.','102-103'],
 'weapon.ratedSpaces':['Reserves weapon capacity in an otherwise empty mount.','This budgets the mount’s volume and price without adding weapon mass or damage.','102-103'],
 'weapon.reservedCrew':['Reserves crew positions inside an empty turret.','These positions consume turret accommodation even though no weapon is installed.','102-103'],
 armSize:['Sets the Size of the configurable robot arm.','Size determines the arm’s base strength and price; strength and dexterity upgrades are budgeted separately.','67; Robot Handbook 25-27'],
 strIncrease:['Raises the selected manipulator arm’s strength above its base value.','Upgrades increase cost and must meet the arm’s characteristic limits. Vehicle-arm STR and DEX increases total at most +5.','67'],
 dexIncrease:['Raises the selected manipulator arm’s dexterity above its base value.','Upgrades increase cost and must meet the arm’s characteristic limits. Vehicle-arm STR and DEX increases total at most +5.','67']
 };
 if(key==='armourShift')return {lines:[`Transfers armour to or from the ${context.face.toLowerCase()} face.`,`Positive values add protection here; negative values remove it. All six transfers must sum to zero. Base-armour floors and exposed-face restrictions still apply.`],pages:'26, 55-56'};
 if(key==='equipment.quantity')return {lines:[`Sets ${context.unit.toLowerCase()} for ${context.name}.`,context.unit==='Carried vehicle shipping tons'?'Enter the carried vehicle’s shipping tons. Docking bays use ceil(4.4 × tons) Spaces; hangars use ceil(8 × tons), including maintenance access.':context.unit==='People supported'?'Enter people, not life-support units. The selected duration and whole-Space rounding determine the installed budget.':context.unit==='Largest aircraft Spaces'?'Enter the largest aircraft’s nominal Spaces. The deck reserves ten deck Spaces per aircraft Space.':context.unit==='Powered towed Spaces'?'Enter the powered vehicle Spaces to be towed; the unpowered towing capacity is twice this amount.':'The count scales the selected component’s budget; its minimum volume and rounding rules still apply.'],pages:context.pages||'57-100'};
 const row=copy[key];return row?{lines:row.slice(0,2),pages:row[2]}:{lines:[]};
}
const api={purposes,system,selection,featurePurposes,feature,input};root.VehicleHelp=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
