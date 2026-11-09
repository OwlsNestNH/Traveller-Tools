// Source-defined high-technology capabilities. No fabrication or consciousness-transfer simulation.
const source=pages=>({book:'Robot Handbook',edition:'Mongoose 2022',pages});
export const METAMORPHIC_TIERS=Object.freeze([{id:'basic',label:'Basic',tl:17,pricePerSlot:50000,morphTime:'1D minutes',appearance:'Enhanced android'},{id:'improved',label:'Improved',tl:18,pricePerSlot:100000,morphTime:'1D rounds',appearance:'Advanced android'},{id:'advanced',label:'Advanced',tl:19,pricePerSlot:200000,morphTime:'1D seconds',appearance:'Superior android'}].map(row=>Object.freeze({...row,source:Object.freeze(source('104')),implemented:true,provisional:true,reason:'Provisional construction convention; not a source-defined complete body formula.'})));
export function fabricationCapabilities(installed){return installed.filter(o=>['fabrication-chamber','open-fabrication'].includes(o.family)).map(o=>{
 const open=o.family==='open-fabrication',grade=o.id.split('-').at(-1),advanced=['advanced','superior'].includes(grade)||open,brainLimit=o.effects.brainLimit??'No robot brains';
 return{id:o.instanceId??o.id,optionId:o.id,label:o.label,allocatedSlots:o.quantity,ratedTechnology:o.tl,source:source(open||grade==='superior'?'51-52,105':'51-52'),
 outputLocation:open?'external':'inside chamber',maximumObjectSlots:open?null:o.quantity/2,approximateOutputLitres:open?null:1.5*o.quantity,maximumWholeRobotBaseSlots:open?null:Math.floor(o.quantity/4),
 standardNonAnimateProductTL:advanced?o.tl:o.tl-2,productTLBasis:'Printed technology of the selected variant; higher-rated variants need their own source.',
 robotBrainLimit:brainLimit,robotBrainMaximumTL:grade==='enhanced'?o.tl-1:advanced?o.tl:null,
 livingOrganism:advanced,biologicalMemories:o.effects.memoryImplantation?'Recorded or implanted memories supported, subject to source data':'Not transferred by fabrication',
 minimumTime:o.effects.time??String(o.effects.hours)+' hours',brainAndNeuralTimeMultiplier:4,complexOrHighTemperatureTimeMultiplier:2,
 materialRequirement:'Feedstock at least equal to output mass, including required constituents.',
 licensing:'Templates and commercial restrictions must be checked; construction capability is not permission to copy controlled products.',
 ...(open?{externalSizeLimit:'Not specified; do not infer unlimited throughput from this omission.',guidance:'Construction swarms require external swarm-controller guidance before TL23; controller compatibility is a separate operating requirement.'}:{}),
 ...(grade==='enhanced'?{includedBioreactor:'Advanced bioreaction capability; can print organs or limbs, not a complete living thinking organism.'}:{})};});}
export function highTechnologyInventory(){return{metamorphic:METAMORPHIC_TIERS,backupServices:[{id:'improved-backup',tl:17,cost:1000000,unit:'backup',purpose:'Non-destructive brain backup; restoration to a Conscious brain',source:source('104')},{id:'permanent-restore',tl:18,cost:1000000,unit:'restore',purpose:'Restore a recorded backup to a biological body',source:source('104')},{id:'continuous-backup',tl:19,cost:1000000,unit:'implant',purpose:'Running brain backup; implantation capacity and compatibility need separate source validation',source:source('104')},{id:'individual-transformations',tl:22,cost:5000000,unit:'transformation',purpose:'Switching natural and mechanical bodies; paired body and transfer procedure not included',source:source('104')}],scope:'Metamorphic construction is provisional under explicit fixed assumptions, not certified full-book construction. Backup/restore prices remain service references, not performed procedures.'};}

// Application conventions fill p104 construction omissions, never source facts.
const METAMORPHIC_CONVENTION='provisional-base-slots-standard-v1';
const assumptionRows=[
 ['price-basis','Base Slots price basis','Original chassis Base Slots','104'],
 ['hardware-cost','Hardware cost assumption','Standard chassis + equipment costs retained','13-78'],
 ['body-reservation','Body reservation assumption','0 additional reserved Slots','104'],
 ['appearance-cost','Appearance cost assumption','No android construction multiplier','104'],
 ['current-form','Current-form manipulator assumption','Standard Size / STR / DEX / Slots / prices','25-26'],
 ['standard-constraints','Hardware constraints assumption','Standard armour / power / brain / capacity checks','13-78']
];
export function metamorphicControls(){return [
 {field:'metamorphicTier',label:'Metamorphic tier (provisional)',type:'select',stage:'chassis',default:'basic',choices:METAMORPHIC_TIERS.map(t=>({...t,label:t.label+' (TL'+t.tl+')'})),source:source('104')},
 {field:'metamorphicConvention',label:'Construction convention (assumption)',type:'select',stage:'chassis',default:METAMORPHIC_CONVENTION,choices:[{id:METAMORPHIC_CONVENTION,label:'Base Slots + standard hardware; 0 reserved Slots'}],source:source('104')}
].map(c=>JSON.parse(JSON.stringify(c)));}
export function evaluateMetamorphicBody(design,{baseSlots,size}){
 const tier=METAMORPHIC_TIERS.find(t=>t.id===design.special.metamorphicTier);
 const profile={provisional:true,convention:METAMORPHIC_CONVENTION,tier:tier.id,label:tier.label,minimumTL:tier.tl,pricePerSlot:tier.pricePerSlot,priceBasisSlots:baseSlots,bodyCost:baseSlots*tier.pricePerSlot,reservedSlots:0,morphTime:tier.morphTime,appearance:tier.appearance,source:source('104'),
 fixedProperties:{size,primaryLocomotion:design.selections.locomotion.primary,secondaryLocomotion:design.selections.locomotion.secondary},
 assumptions:assumptionRows.map(([id,label,value,pages])=>({id,label,value,provenance:'Application convention',source:source(pages)})),
 operatingScope:['Selected current form only','Size and locomotion fixed','Morphable features; no free equipment grants','Transient morph states not simulated','Extra attacks not granted']};
 const diagnostics=[{severity:'warning',code:'METAMORPHIC_PROVISIONAL',path:'special.metamorphicConvention',message:'Provisional construction: original Base Slots times the printed rate, plus ordinary hardware costs; zero additional body reservation, no android multiplier, and ordinary current-form manipulator rules. These are application conventions, not printed construction definitions.',source:source('104')}];
 if(design.techLevel<tier.tl)diagnostics.push({severity:'error',code:'METAMORPHIC_TL',path:'special.metamorphicTier',message:'Selected metamorphic tier requires TL'+tier.tl+'.',source:source('104')});
 return{profile,diagnostics,ledger:{id:'metamorphic-body',label:'Metamorphic body (provisional Base Slots basis)',cost:profile.bodyCost,slots:0,baseSlots,pricePerSlot:tier.pricePerSlot,provisional:true,convention:METAMORPHIC_CONVENTION,note:'Application convention; zero additional body reservation',source:source('104')}};
}
