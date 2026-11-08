import {aslanEndTerm,aslanBenefits,run,settle,buildAslanRestorationFixture} from './aslan-officer-fixtures.mjs';
// Choose a genuine failed qualification, without depending on a previous setup's RNG position.
export function buildFailedAslanRestorationEntryFixture(){
 for(let seed=0;seed<40;seed++){
  let r=buildAslanRestorationFixture({seed:'restoration-failed-browser-'+seed});
  r=run(r,'resolve-aslan-restoration',{accept:true,originalSOC:8,originalSOCConfirmed:true,statusTiming:'on-successful-entry',reason:'GM verified original SOC and records this source timing ruling.'});
  r=aslanBenefits(run(aslanEndTerm(settle(r)),'leave-career'));
  const probe=run(r,'career',{id:'aslan.military-officer',assignment:'leader'});
  if(probe.state.stage==='failed-entry'&&probe.state.character.aslanRestorations.at(-1).attempt.success===false)return r;
 }
 throw Error('No genuine failed restoration qualification fixture found.');
}
