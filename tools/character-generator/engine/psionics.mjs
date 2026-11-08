// Original mechanical helpers. Sources: Core Rulebook Update 2022 pp228-229;
// Aliens of Charted Space Volume 1 Update 2026 pp254-256.
export const PSIONIC_SOURCE=Object.freeze({id:'core',page:228});
export const TALENT_DEFINITIONS=Object.freeze([
 {talent:'Telepathy',learningDM:4},{talent:'Clairvoyance',learningDM:3},
 {talent:'Telekinesis',learningDM:2},{talent:'Awareness',learningDM:1},
 {talent:'Teleportation',learningDM:0},{talent:'Technopathy',learningDM:0,zhodaniOnly:true}
].map(Object.freeze));
const need=(ok,message)=>{if(!ok)throw new Error(message);};
const integer=(n,min,max,label)=>{need(Number.isInteger(n)&&n>=min&&n<=max,label+' is invalid.');return n;};
const dm=n=>n<=0?-3:n<3?-2:n<6?-1:n<9?0:n<12?1:n<15?2:3;
export function psionicPotential({roll,careerTerms=0}){
 integer(roll,2,12,'Potential roll');integer(careerTerms,0,100,'Completed career terms');
 return {source:PSIONIC_SOURCE,natural:roll,careerTerms,psi:Math.max(0,roll-careerTerms)};
}
export function talentAcquisition({talent,psi,previousChecks=0,firstTalentChosen=false,roll,species='human'}){
 const definition=TALENT_DEFINITIONS.find(x=>x.talent===talent);need(definition&&!definition.zhodaniOnly||definition&&species==='zhodani','Unsupported talent for this training.');
 integer(psi,1,40,'Positive PSI');integer(previousChecks,0,1000,'Previous check count');need(typeof firstTalentChosen==='boolean','First-talent history is required.');
 need(firstTalentChosen||previousChecks===0,'Previous checks contradict first-talent history.');
 const automatic=talent==='Telepathy'&&!firstTalentChosen;
 if(!automatic)integer(roll,2,12,'Acquisition roll');else need(roll===undefined,'Automatic Telepathy does not roll.');
 const psiDM=dm(psi),learningDM=definition.learningDM,total=automatic?null:roll+psiDM+learningDM-previousChecks;
 // Automatic Telepathy makes no CHECK: it does not increase the previous-check count.
 return {source:species==='zhodani'?{id:'aliens',page:255}:PSIONIC_SOURCE,talent,automatic,previousChecks,natural:automatic?null:roll,psi,psiDM,learningDM,total,target:8,success:automatic||total>=8,checksAdded:automatic?0:1,level:0};
}
export function psionicTalentOptions({species='human',acquired=[],attempted=[],previousChecks=0,firstTalentChosen=false,talent=null}){
 return TALENT_DEFINITIONS.filter(x=>(!x.zhodaniOnly||species==='zhodani')&&!acquired.includes(x.talent)&&(talent?x.talent===talent:!attempted.includes(x.talent))).map(x=>({talent:x.talent,learningDM:x.learningDM,previousChecks,automatic:x.talent==='Telepathy'&&!firstTalentChosen}));
}
