import {careerInfoFixture} from './career-info-fixtures.mjs';
import {run} from './core-life-event-fixtures.mjs';
export function vargrTemplateStart(){
 let r=careerInfoFixture('vargr');
 // Public, recorded source-approved training gives this synthetic review character Psion access.
 for(const [type,payload] of [['gm-mode',{enabled:true}],['add-extra',{id:'PSI'}],['gm-override',{field:'stat.PSI',value:15,reason:'Synthetic trained Vargr fixture'}],['begin-psionic-training',{}],['resolve-book',{confirmed:true,note:'Synthetic referee-approved training',psionicApproved:true,psionicCost:0,psionicFunding:'provided',psionicTimingConfirmed:true}],['learn-talent',{talent:'Telepathy'}],['finish-psionic-training',{}]])r=run(r,type,payload);
 return r;
}
