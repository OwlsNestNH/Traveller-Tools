// Selected operating conditions only, not elapsed-time or maintenance simulation.
const source=pages=>({book:'Robot Handbook',edition:'Mongoose 2022',pages});
export function evaluatePowerMode(design,installed){
 const p=design.selections.physical,diagnostics=[],projections=[],noInternalPower=installed.some(o=>o.effects?.removesInternalPower),units=installed.filter(o=>['rtg-long-duration','rtg-short-duration','solar-power-unit'].includes(o.family)),coating=installed.find(o=>o.family==='solar-coating');
 const light=p.solarLight??'full',zone=p.solarZone??'habitable',activity=p.alternativeActivity??'normal';
 const issue=(severity,code,message,pages='33,55-57')=>diagnostics.push({severity,code,path:'physical.powerMode',message,source:source(pages)});
 const powerState={mode:p.powerMode,limited:false,external:false,sustainedAlternative:false,movementFactor:1,strengthFactor:1,agilityPenalty:0,maximumGroundSpeed:null,maximumFlyingSpeed:null,shutdown:false,restrictedPhysicalActivity:false};
 const modes=[];
 for(const o of units){
  const rtg=o.family.startsWith('rtg-'),condition=o.parameters.powerCondition??'full',panels=o.parameters.panelState??'deployed';let level='half';
  if(rtg)level=condition==='expired'?'off':condition==='degraded'?'quarter':'half';
  else if(panels==='stowed'||['frozen','outer'].includes(zone))level='off';else if(light!=='full')level='unknown';else if(zone==='first-cold')level='quarter';else if(zone==='second-cold')level='stationary';
  modes.push({o,level});
  projections.push({id:o.instanceId??o.id,optionId:o.id,quantity:o.quantity,condition:rtg?condition:panels,source:source(rtg?'55-56':'55,57'),operatingLevel:level,
   ...(rtg?{ratedHalfLifeYears:o.effects?.halfLifeYears??null,rechargeHoursPerEnduranceHour:condition==='full'?3:condition==='degraded'?6:null,chargingCondition:'Stationary or minimal activity; powered-off storage does not extend radioactive lifetime.'}:{ratedServiceYears:o.effects?.serviceLifeYears??o.effects?.enduranceYears??null,darkHoursPerSunlitHour:{normal:.5,quarter:1,stationary:2},rechargeHoursPerPackHour:{normal:8,quarter:4,stationary:2},chargingCondition:'While in sunlight at the stated activity; solar storage history is not assumed.',deployment:{active:panels==='deployed',sizeIncrease:1,stealthDM:-2,opponentSensorOrReconDM:2,hitsFraction:.1,armour:'Base armour only',condition:'Applies only with panels deployed.'}})});
 }
 if(coating){const ids=['basic','improved','enhanced','advanced'],grade=ids.findIndex(g=>coating.id.endsWith(g)),loss=(light==='low'?1:0)+({habitable:0,'first-cold':1,'second-cold':2,frozen:3,outer:4}[zone]??0),effective=light==='none'?-1:grade-loss;
  projections.push({id:coating.instanceId??coating.id,optionId:coating.id,effectiveGrade:effective>=0?ids[effective]:null,source:source('33'),maximumGroundSpeed:effective<0?0:[1,2,4,'full'][effective],maximumFlyingSpeed:effective<0?0:[0,0,1,2][effective],rechargeHoursPerEnduranceHour:effective<0?null:effective===0?4:1,chargingCondition:effective===0?'Dormant or no mobility.':'Dormant; at minimal activity and speed at most1m, charging takes4 hours per endurance hour.'});
  if(p.powerMode==='solar-coating-only'){
   powerState.sustainedAlternative=true;powerState.maximumGroundSpeed=effective<0?0:[1,2,4,null][effective];powerState.maximumFlyingSpeed=effective<0?0:[0,0,1,2][effective];powerState.shutdown=effective<0;
   if((p.coatingPowerRule??'unresolved')==='unresolved')issue('blocker','COATING_POWER_INTERPRETATION','Solar coating has explicit movement caps, while the general alternative-power section also mentions STR and Agility penalties. Choose a disclosed interpretation for those non-movement outputs.');
   else if(p.coatingPowerRule==='general-power'){powerState.strengthFactor=.5;powerState.agilityPenalty=2;powerState.limited=true;issue('warning','COATING_POWER_INTERPRETATION','Using general alternative-power STR/Agility penalties, with the specific solar-coating movement table.');}
   else issue('warning','COATING_POWER_INTERPRETATION','Using the solar-coating-specific mobility limits without importing the separate power-unit STR/Agility penalties.');
   if(effective<0)issue('blocker','SOLAR_COATING_NO_OUTPUT','Selected light/distance leaves no supported solar-coating output. The installed coating remains legal, but this claimed operating state cannot power the robot.');
  }
 }else if(p.powerMode==='solar-coating-only')issue('error','SOLAR_COATING_REQUIRED','Install a solar coating before selecting solar-coating-only operation.');
 if(p.powerMode==='conventional'&&noInternalPower&&!p.powerPacks)issue('blocker','POWER_SOURCE_UNSPECIFIED','Specify a direct external connection or the operating condition of installed alternative power. No internal power does not prohibit tethered designs.');
 if(p.powerMode==='direct-connection'){powerState.external=true;issue('warning','TETHERED_POWER','Operation assumes a live external connection. Cable reach limits mobility; loss of power shuts down a robot without stored energy.');}
 if(['alternate-full','conditioned-alternative'].includes(p.powerMode)){
  if(p.powerMode==='conditioned-alternative'&&activity!=='normal'&&!units.some(o=>o.family==='solar-power-unit'))issue('error','SOLAR_ACTIVITY_WITHOUT_UNIT','The selected reduced solar-unit activity requires an installed solar power unit. RTG recharge conditions are reported separately.');
  powerState.sustainedAlternative=true;
  if(!units.length)issue('blocker','ALTERNATE_POWER_REQUIRED','This mode requires an installed RTG or solar power unit.');
  else if(p.powerMode==='alternate-full'&&modes.some(m=>m.level!=='half'))issue('blocker','ALTERNATE_FULL_CONFLICT','The explicitly selected source condition is not full capability. Use conditioned-alternative mode or restore full-capability conditions.');
  else{
   const active=modes.filter(m=>m.level!=='off'),fullCount=active.filter(m=>m.level==='half').reduce((n,m)=>n+m.o.quantity,0),count=active.reduce((n,m)=>n+m.o.quantity,0);
   if(fullCount>=2&&activity==='normal'){powerState.movementFactor=1;powerState.strengthFactor=1;if(active.some(m=>m.level==='unknown'))issue('warning','SUPPLEMENTAL_POWER_UNCERTAIN','Two full-capability sources already supply the selected normal operating state. Supplemental solar output remains unknown and is not needed or added to that result.');}
   else if(active.some(m=>m.level==='unknown'))issue('blocker','SOLAR_UNIT_LIGHT','Dim or dark solar-unit output depends on prior charging and local conditions, which are not supplied. No stored endurance is invented.');
   else if(!count){powerState.shutdown=true;issue('blocker','ALTERNATE_NO_OUTPUT','Installed sources are unavailable in this selected state. This does not prohibit their installation.');}
   else if(count>1&&activity!=='normal')issue('blocker','MULTI_SOURCE_ACTIVITY','Reduced-activity recharge/output combinations for multiple sources are not specified. Select normal activity or review that condition separately.');
   else if(fullCount>=2){powerState.movementFactor=1;powerState.strengthFactor=1;}
   else if(count>1&&active.some(m=>m.level!=='half'))issue('blocker','DEGRADED_POWER_COMBINATION','The book does not specify combined output for mixed or multiple degraded sources. No additive wattage rule is assumed.');
   else{
    let level=active[0].level;
    if(active[0].o.family==='solar-power-unit'&&activity==='quarter'&&level==='half')level='quarter';
    if(active[0].o.family==='solar-power-unit'&&activity==='stationary')level='stationary';
    powerState.limited=true;powerState.movementFactor=level==='half'?.5:level==='quarter'?.25:0;powerState.strengthFactor=level==='half'?.5:level==='quarter'?.25:1;powerState.agilityPenalty=level==='half'?2:4;
    if(level==='stationary'){powerState.restrictedPhysicalActivity=true;issue('blocker','STATIONARY_POWER_ACTIVITY','Stationary limited activity is supported, but a usable STR value for that state is not specified. Its recharge ratios are reported without inventing a full-strength operating result.');}
   }
  }
  if(powerState.limited&&noInternalPower&&!p.powerPacks&&p.vehicleSpeed)issue('error','LOW_POWER_VEHICLE','A design relying solely on one reduced-output alternative source cannot support installed vehicle-speed movement.');
  if(p.powerMode==='alternate-full')issue('warning','ALTERNATE_FULL_CONDITION','Selected units are assumed fully capable: deployed solar panels in adequate light and non-degraded RTGs.');
 }
 return{diagnostics,powerState,powerProjections:projections,noInternalPower};
}
