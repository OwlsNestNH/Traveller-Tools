import {buildAslanOutlawRestorationFixture,aslanBenefits,run,force,settle,rejected} from './aslan-officer-fixtures.mjs';
export {buildAslanOutlawRestorationFixture,aslanBenefits,run,force,settle,rejected};
export const maleRestoration={decision:'restore',originalSOC:8,originalSOCConfirmed:true,reason:'Referee verified the original family SOC8 for the earned Outlaw restoration.'};
export const femaleRestoration={decision:'marry',unmarriedConfirmed:true,reason:'Referee verified that this Traveller is currently unmarried and accepts the source marriage.'};
export function buildOutlawDepartureFixture({gender='male',boons=0,age=null,ready=false}={}){
 let r=buildAslanOutlawRestorationFixture({gender,boons,age});
 r=gender==='male'?run(r,'resolve-aslan-outlaw-restoration',maleRestoration):force(r,'resolve-aslan-outlaw-restoration',femaleRestoration,[4,4]);
 if(r.state.stage==='ageing')r=settle(force(r,'ageing',{},[6,6]));
 return ready?aslanBenefits(run(r,'leave-career')):r;
}
export function buildHistoricalEntryFixture({gender='male',approved=false,careerId='aslan.military',assignment}={}){
 let r=buildOutlawDepartureFixture({gender,ready:true});r=run(r,'request-aslan-historical-entry',{careerId,assignment:assignment??(gender==='male'?'warrior':'support')});
 if(approved)r=run(r,'resolve-aslan-historical-entry',{approved:true,reason:'Referee permits only the requested next career entry after the source-earned restoration.'});
 return r;
}
