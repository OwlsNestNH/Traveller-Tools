import {buildAslanOriginFixture} from './aslan-origin-fixtures.mjs';
import {educationReady,forceEducation,command} from './education-result-fixtures.mjs';
export const eventFixture=row=>forceEducation(educationReady(),'education-event',{},[Math.max(1,row-6),Math.min(6,row-1)]);
export const eventStep=(r,values)=>forceEducation(r,'roll-education-event-step',{pendingId:r.state.pendingEducationEventRoll.id},values);
export function checkpointFixtures(){
 const fixtures=[];for(const row of [2,3,4,5,6,7,8,10,11,12])fixtures.push({label:'event-'+row,result:eventFixture(row),capture:[2,3,4,5,6,10].includes(row)});
 for(const row of [4,6,8,11])fixtures.push({label:'resolved-'+row,result:eventStep(eventFixture(row),row===6?[5]:[6,6]),capture:row===6});
 for(const index of [0,1])fixtures.push({label:'potential-'+index,result:command(eventFixture(2),'choose-effect',{index})});
 const recorded=command(eventFixture(2),'gm-override',{field:'stat.PSI',value:0,reason:'Synthetic recorded zero potential'});fixtures.push({label:'potential-recorded',result:recorded});fixtures.push({label:'potential-recorded-result',result:command(recorded,'choose-effect',{index:0})});
 fixtures.push({label:'challenge-result',result:command(eventFixture(10),'education-check',{name:'Medic'})});
 const choice=eventStep(eventFixture(11),[1,1]);fixtures.push({label:'departure-choice',result:choice});const draft=command(choice,'choose-effect',{index:1});fixtures.push({label:'draft-roll',result:draft,capture:true});fixtures.push({label:'draft-result',result:eventStep(draft,[4])});
 const injury=eventStep(eventFixture(7),[1,1]);fixtures.push({label:'injury-roll',result:injury,capture:true});const severity=eventStep(injury,[1]);fixtures.push({label:'severity-roll',result:severity});
 fixtures.push({label:'hobby-result',result:command(eventFixture(9),'education-skill',{name:'Engineer'})});
 let aslan=buildAslanOriginFixture({gender:'male',stage:'precareer'});aslan=forceEducation(aslan,'precareer',{id:'core.university'},[6,6]);aslan=command(aslan,'education-skill',{name:'Admin'});aslan=command(aslan,'education-skill',{name:'Medic'});aslan=command(aslan,'gm-override',{field:'stat.SOC',value:7,reason:'Synthetic acquisition boundary'});aslan=forceEducation(aslan,'education-event',{},[4,5]);aslan=command(aslan,'education-skill',{name:'Independence'});
 fixtures.push({label:'independence-roll',result:aslan,capture:true});
 for(const values of [[3,4],[4,4]])fixtures.push({label:'independence-'+(values[0]===3?'failure':'success'),result:eventStep(aslan,values),capture:true});
 let aged=command(educationReady(),'gm-override',{field:'age',value:34,reason:'Synthetic ageing boundary'});aged=forceEducation(aged,'education-event',{},[1,2]);fixtures.push({label:'interrupted-ageing',result:aged,capture:true});
 for(const row of [9,10])fixtures.push({label:'life-'+row+'-benefit',result:eventStep(eventFixture(7),[Math.max(1,row-6),Math.min(6,row-1)]),capture:true});
 fixtures.push({label:'artefact-result',result:eventStep(eventStep(eventFixture(7),[6,6]),[3]),capture:true});
 let medical=eventStep(eventStep(eventFixture(7),[1,1]),[3]);medical=command(medical,'injury-loss',{index:0});medical=command(medical,'injury-treatment',{restore:{STR:2},inService:false});fixtures.push({label:'medical-bill-result',result:medical,capture:true});
 let crime=eventStep(eventFixture(7),[5,6]);crime=command(crime,'resolve-life-event',{confirmed:true,reason:'Synthetic consequence review',outcome:'lose-benefit'});fixtures.push({label:'future-benefit-loss',result:crime,capture:true});
 let psi=command(educationReady(),'gm-override',{field:'stat.PSI',value:8,reason:'Synthetic known potential'});psi=forceEducation(psi,'education-event',{},[3,4]);psi=eventStep(eventStep(psi,[6,6]),[1]);psi=command(psi,'resolve-life-event',{confirmed:true,reason:'Synthetic access review',outcome:'test',funding:'provided',cost:0,timingConfirmed:true});fixtures.push({label:'conditional-psion-access',result:psi,capture:true});
 return fixtures;
}
