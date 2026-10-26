import {decimal,add,multiply,numeric,exact} from './power-arithmetic.mjs';

// High Guard Update 2022 pp16–17,70–71. Explicit component choices, never inferred from ship TL.
export const DRIVE_TECH_PROFILES={
 unknown:{label:'Unverified options',points:null,side:null,tl:0},
 standard:{label:'Standard',points:0,side:null,tl:0},
 early:{label:'Early prototype',points:2,side:'disadvantage',tl:-2},
 prototype:{label:'Prototype',points:1,side:'disadvantage',tl:-1},
 budget:{label:'Budget',points:1,side:'disadvantage',tl:0},
 advanced:{label:'Advanced',points:1,side:'advantage',tl:1},
 veryAdvanced:{label:'Very advanced',points:2,side:'advantage',tl:2},
 highTechnology:{label:'High technology',points:3,side:'advantage',tl:3}
};
export const DRIVE_TECH_OPTIONS=[
 {id:'efficient',name:'Energy Efficient',side:'advantage',points:1,power:-.25,note:'25% less design Power'},
 {id:'smaller',name:'Size Reduction',side:'advantage',points:1,power:0,note:'10% smaller drive; no Power reduction'},
 {id:'inefficient',name:'Energy Inefficient',side:'disadvantage',points:1,power:.30,note:'30% more design Power'},
 {id:'limited',name:'Limited Range',side:'disadvantage',points:1,power:0,note:'100-diameter limit; range restriction recorded'},
 {id:'larger',name:'Increased Size',side:'disadvantage',points:1,power:0,note:'25% larger drive; no Power increase'},
 {id:'orbital',name:'Orbital Range',side:'disadvantage',points:2,power:0,note:'Planetary Short-range restriction recorded'}
];
const kinds=['unknown','mdrive','combined','reaction','none','concealed'];
const amount=(v,name,max=1000000)=>{if(v==null)return null;if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>max)throw Error(name+' must be a nonnegative finite number.');return v||0;};
export function normalizeManoeuvre(v){
 if(!v||typeof v!=='object'||Array.isArray(v)||v.version!==1)throw Error('Invalid design drive record.');
 if(!['recorded','auto','manual'].includes(v.mode)||!kinds.includes(v.kind))throw Error('Choose a drive type and Power basis.');
 const t=v.tech;if(!t||!Object.hasOwn(DRIVE_TECH_PROFILES,t.profile)||!Array.isArray(t.options)||t.options.length>3||typeof t.repeatApproved!=='boolean')throw Error('Invalid drive tech options.');
 const rows=t.options.map(id=>{const option=DRIVE_TECH_OPTIONS.find(o=>o.id===id);if(!option)throw Error('Choose a verified drive tech option.');return option;});
 if(new Set(rows.map(o=>o.side)).size>1)throw Error('A component cannot mix advantages and disadvantages.');
 const profile=DRIVE_TECH_PROFILES[t.profile],points=rows.reduce((n,o)=>n+o.points,0);
 if(profile.points!=null&&(points>profile.points||rows.some(o=>o.side!==profile.side)))throw Error('Drive tech options exceed or conflict with the selected component profile.');
 if(new Set(t.options).size<t.options.length&&!t.repeatApproved)throw Error('Repeated tech options require explicit referee approval.');
 if(rows.length&&!['mdrive','combined','concealed'].includes(v.kind))throw Error('These tech options apply to an M-drive, not the selected drive type.');
 const mdriveThrust=amount(v.mdriveThrust,'M-drive contribution',10000);if(mdriveThrust!=null&&!Number.isSafeInteger(mdriveThrust))throw Error('M-drive contribution must be a whole number.');
 return {version:1,mode:v.mode,kind:v.kind,manualPower:amount(v.manualPower,'Manual design Power'),mdriveThrust,tech:{profile:t.profile,options:[...t.options],repeatApproved:t.repeatApproved}};
}
export const isDriveRequirement=name=>['manoeuvre','manoeuvredrive'].includes((name??'').toLowerCase().replace(/[^a-z]/g,''));
export function recordedDrivePower(design){
 const rows=(design?.record?.requirements??[]).filter(r=>isDriveRequirement(r.name));
 if(rows.length!==1)return {value:null,reason:rows.length?'Multiple drive requirement records need review.':'No recorded M-drive Power requirement.',source:null,basis:'Recorded'};
 const r=rows[0];return {value:r.power??null,reason:r.power==null?'Recorded M-drive Power is unknown.':'',source:r.source??design?.source??null,basis:r.basis==='manual override'?'Manual recorded':'Recorded',record:r};
}
export function initialManoeuvre(design){
 if(design?.record?.manoeuvre)return structuredClone(design.record.manoeuvre);
 return {version:1,mode:design?'recorded':'auto',kind:design?'unknown':'mdrive',manualPower:null,mdriveThrust:null,tech:{profile:design?'unknown':'standard',options:[],repeatApproved:false}};
}
export function designDrivePower(design){
 const raw=design?.record?.manoeuvre;
 if(!raw)return {...recordedDrivePower(design),ratedThrust:design?.thrust??null};
 const c=normalizeManoeuvre(raw);if(c.mode==='recorded')return {...recordedDrivePower(design),ratedThrust:design?.thrust??null};
 const source={book:'High Guard Update 2022',page:17},ratedThrust=c.kind==='combined'?c.mdriveThrust:design?.thrust??null;
 const unknown=reason=>({value:null,reason,source,basis:c.mode==='manual'?'Manual design override':'Calculated design',ratedThrust});
 if(c.mode==='manual')return {...unknown(c.manualPower==null?'Enter a manual design Power value or leave it explicitly unknown.':''),value:c.manualPower,source:null};
 if(c.kind==='none'||c.kind==='reaction')return {value:0,exact:'0',reason:'',source,basis:c.kind==='none'?'No drive':'Reaction drive · no Power',ratedThrust};
 if(c.kind==='unknown')return unknown('Drive installation type is unknown.');
 if(c.kind==='concealed')return unknown('Concealed-drive Power adjustment is not specified; retain a recorded value or use a verified manual override.');
 if(design?.tons==null||ratedThrust==null)return unknown('Hull tonnage or rated M-drive Thrust is unknown.');
 if(c.kind==='combined'&&ratedThrust>design.thrust)return unknown('M-drive contribution exceeds total rated ship Thrust.');
 const profile=DRIVE_TECH_PROFILES[c.tech.profile],rows=c.tech.options.map(id=>DRIVE_TECH_OPTIONS.find(o=>o.id===id));
 if(profile.points==null)return unknown('Drive efficiency/options are unverified; choose the component profile and its options.');
 if(rows.reduce((n,o)=>n+o.points,0)!==profile.points)return unknown('Select all tech options for this component profile before calculating Power.');
 const baseTL=[9,9,10,10,11,11,12,13,14,15,16,17][ratedThrust],requiredTL=baseTL==null?null:baseTL+profile.tl;
 const warnings=[];if(requiredTL==null)warnings.push('Rated drive Thrust exceeds the verified TL table; fit needs referee review.');else if(design.record?.tl==null)warnings.push('Ship TL is unknown; component TL fit is unverified.');else if(design.record.tl<requiredTL)warnings.push('Component requires TL '+requiredTL+'; the recorded ship TL is lower.');
 let factor=decimal(1);for(const o of rows)factor=add(factor,decimal(o.power));
 const base=multiply(decimal(design.tons),ratedThrust===0?decimal(.025):multiply(decimal(.1),decimal(ratedThrust))),power=multiply(base,factor);
 return {value:numeric(power),exact:exact(power),reason:'',source,basis:'Calculated design',ratedThrust,requiredTL,warnings,formula:exact(base)+' × '+exact(factor)};
}
