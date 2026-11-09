// Original land-claim procedure: Aliens Vol1 Update2026 pp16-17,47.
// Family estate expectations remain distinct from redeemed claims and owned assets.
import {SPECIES_RULES} from './expansion-pack.mjs';
export const ASLAN_LAND_SOURCE=Object.freeze({id:'aliens',pages:[17,47]});
export const ASLAN_LAND_LIMITS=Object.freeze({minimumShares:3,minimumSOC:9,worldNameMaxLength:120,worldLocationMaxLength:160,worldReferenceMaxLength:160,reasonMaxLength:500,relativeNameMaxLength:120,minParcelBaseline:1,minParcelIncrement:0,maximumInteger:Number.MAX_SAFE_INTEGER,claimRequiresGM:true});
const need=(v,m)=>{if(!v)throw Error(m);};
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const keys=(v,allowed,m)=>need(object(v)&&Object.keys(v).every(k=>allowed.includes(k)),m);
const int=(v,min,max,label)=>{need(Number.isSafeInteger(v)&&v>=min&&v<=max,label+' is out of range.');return v;};
const text=(v,max,label)=>{need(typeof v==='string'&&v.trim().length>0&&v.length<=max,label+' must be a nonempty string of at most '+max+' characters.');return v.trim();};
export function aslanLandRules(soc){
 const row=SPECIES_RULES.aslan.land.rows.find(r=>r.SOC===soc);
 return {...ASLAN_LAND_LIMITS,soc:Number.isSafeInteger(soc)?soc:null,source:{...ASLAN_LAND_SOURCE},minimumParcels:row?.parcels??null,increment:row?.increment??null,requiresParcelRuling:Number.isSafeInteger(soc)&&soc>=9&&!row,eligibleSOC:Number.isSafeInteger(soc)&&soc>=9};
}
export function aslanLandPlan({soc,quantity,world,parcelRuling,gm=false}={}){
 int(soc,9,40,'Current SOC');int(quantity,3,100000000,'Invested shares');keys(world,['name','location','reference'],'Select an identifiable world using only name, location and optional reference.');
 const selectedWorld={name:text(world.name,120,'World name'),location:text(world.location,160,'World location'),selection:'player-selected',catalogChecked:false};
 if(Object.hasOwn(world,'reference'))selectedWorld.reference=text(world.reference,160,'World reference');
 const rule=aslanLandRules(soc);let minimumParcels=rule.minimumParcels,increment=rule.increment,ruling=null;
 if(rule.requiresParcelRuling){need(gm===true,'Enable GM mode for a current SOC outside the printed parcel table.');keys(parcelRuling,['minimumParcels','increment','reason'],'Record the unprinted-SOC minimum, increment and referee reason.');minimumParcels=int(parcelRuling.minimumParcels,1,Number.MAX_SAFE_INTEGER,'Parcel minimum');increment=int(parcelRuling.increment,0,Number.MAX_SAFE_INTEGER,'Parcel increment');ruling={minimumParcels,increment,reason:text(parcelRuling.reason,500,'Parcel referee reason'),method:'referee-baseline'};}
 else need(parcelRuling===undefined,'Use the printed current-SOC parcel calculation, not a replacement ruling.');
 const parcels=minimumParcels+(quantity-3)*increment;need(Number.isSafeInteger(parcels)&&parcels>0,'Calculated parcels exceed the supported exact integer range. No shares have been spent.');
 return {source:{...ASLAN_LAND_SOURCE},world:selectedWorld,socAtRedemption:soc,minimumParcels,increment,parcels,parcelRuling:ruling};
}
export function aslanLandTiming({age,die}={}){
 need(Number.isFinite(age)&&age>=0,'A recorded chronological age is required.');int(die,1,6,'Land delay die');const delayYears=die+3;return {delayYears,eligibleAge:age+delayYears};
}
export function aslanLandResolution({claim,age,independence,gm,payload}={}){
 keys(payload,['claimId','mode','claimEstablished','reason','relativeName'],'Use only the claim, mode, actual-claim confirmation, reason and applicable relative identity.');
 need(claim?.status==='pending','Select an existing unresolved land claim.');need(payload.claimId===claim.id,'The selected claim does not match its record.');need(gm===true,'Enable GM mode to record an already-established land claim.');need(Number.isFinite(age)&&age>=claim.eligibleAge,'The recorded land claim is not yet mature. No time is advanced by this action.');
 need(['personal-return','relative-administration'].includes(payload.mode),'Choose personal return or relative administration.');need(payload.claimEstablished===true,'Confirm that the claim was actually established; travel and legal completion are not simulated.');const reason=text(payload.reason,500,'Actual-claim referee reason');
 let relativeName=null;if(payload.mode==='relative-administration'){need(Number.isFinite(independence)&&independence>=3,'Relative administration requires Independence 3 or higher.');relativeName=text(payload.relativeName,120,'Relative identity');}else need(!Object.hasOwn(payload,'relativeName'),'Personal return does not use a relative identity.');
 return {source:{id:'aliens',page:47},mode:payload.mode,claimEstablished:true,reason,relativeName,age,independence:payload.mode==='relative-administration'?independence:null,method:'referee-confirmed-actual-claim',travelSimulated:false};
}
