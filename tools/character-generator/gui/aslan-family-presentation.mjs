export {familyNarrative,familyBandLabels,familyBandFromSOC} from '../shared/aslan-family-presentation.mjs';
import {familyNarrative,familyBandLabels,familyBandFromSOC} from '../shared/aslan-family-presentation.mjs';
export function aslanFamilyPopupModel(state) {
 const origin=state.currentAslanOrigin;
 if(!origin?.familyPresentation || state.character.species!=='aslan')return null;
 const family=origin.family;
 if(state.stage==='aslan-family' && origin.gender && !family){
  const band=origin.familyBandDecision?.band??familyBandFromSOC(origin.familySOC);
  return {bandLabel:familyBandLabels[band]??'Family classification needed'};
 }
 if(!family || !['aslan-family-result','effect-choice'].includes(state.stage))return null;
 if(state.stage==='effect-choice' && family.status!=='resolving-award')return null;
 const choices=state.stage==='effect-choice'?(state.pendingChoice?.options??[]).map((option,index)=>({
  index,available:option.available!==false,
  label:option.effects?.every(e=>e.kind==='skill'&&e.mode==='set')?option.effects.map(e=>e.name+' '+e.value).join(' + '):option.label,
 })).filter(option=>option.available):[];
 const gained=Object.entries(family.awardsAfter??{}).filter(([name,level])=>!Object.hasOwn(family.awardsBefore??{},name)||level>family.awardsBefore[name]);
 return {bandLabel:familyBandLabels[family.band],die:family.die,...familyNarrative(family.band,family.die),choices,
  awardSummary:gained.length?'Recorded: '+gained.map(([name,level])=>name+' '+level).join(' · '):'No additional family skill is awarded.',
  rerolls:family.rerolls??[],acquisition:family.acquisition??null,
 };
}
