// Read-only descriptions of implemented table mechanics. These are not awards.
import {careerOutcomeSummary} from './career-outcome-summary.mjs';
const words=s=>String(s??'').replace(/^(core|aslan|vargr|zhodani)\./,'').replaceAll('-',' ');
const signed=n=>(n>=0?'+':'')+n;
export function eventEffectSummary(effects=[]){
 if(!effects.length)return 'No automatic mechanical effect.';
 return effects.map(e=>{
  const describe=rows=>eventEffectSummary(rows??[]);
  switch(e.kind){
   case 'choice':return 'Choose: '+e.options.map(o=>o.label+' ('+describe(o.effects)+')').join(' or ')+'.';
   case 'skill-choice':return 'Choose '+(e.count??1)+' skill'+((e.count??1)>1?'s':'')+(e.allowed?.length?' from '+e.allowed.join(', '):e.scope==='existing'?' you already have':e.scope&&e.scope!=='any'?' ('+words(e.scope)+')':'')+(e.mode==='set'?' at least level '+(e.value??1):' to increase by '+(e.value??1))+(e.exclude?.length?', excluding '+e.exclude.join(', '):'')+'.';
   case 'check':return 'Check '+(e.stat??e.skills?.join(' or ')??(e.skillScope==='learned-this-term'?'a skill learned this term':'the specified skill'))+' '+e.target+'+. On success: '+describe(e.success)+' On failure: '+describe(e.failure)+(e.total?' Special totals: '+Object.entries(e.total).map(([n,rows])=>n+': '+describe(rows)).join(' '):'');
   case 'education-status':return e.graduationAllowed===false?'Cannot graduate this term.':'Resolve education status.';
   case 'education-skill-choice':return 'Choose a study skill'+(Array.isArray(e.options)?' from '+e.options.map(o=>typeof o==='string'?o:o.name).join(', '):'')+' at level '+e.value+(e.exclude?.length?', excluding '+e.exclude.join(', '):'')+'.';
   case 'checked-skill':return 'Increase the skill used for the successful check by '+e.value+'.';
   case 'career-status':return e.action==='next'?'Enter '+words(e.career)+' next term'+(e.viaDraft?' through the draft':'')+'.':careerOutcomeSummary([e]);
   case 'psionic-test':return 'May test psionic potential; this does not itself grant training.';
   case 'career-permission':return 'Permission to attempt '+words(e.career)+' in '+words(e.scope)+'.';
   case 'conditional':return 'If '+(e.condition?.gender?'gender is '+e.condition.gender:e.condition?.stat?e.condition.stat+' is at least '+e.condition.min:'the source condition applies')+': '+describe(e.then)+' Otherwise: '+describe(e.otherwise);
   case 'assignment-effect':return Object.entries(e.assignments).map(([id,rows])=>words(id)+': '+describe(rows)).join(' ');
   case 'random':return 'Roll '+e.dice+': '+e.outcomes.map(o=>(o.min===o.max?o.min:o.min+'–'+o.max)+': '+describe(o.effects)).join(' ');
   case 'stat':return e.name+' '+(e.dice?(e.multiplier<0?'-':'+')+e.dice+(Math.abs(e.multiplier??1)!==1?' × '+Math.abs(e.multiplier):''):signed(e.value))+(e.minimum!==undefined?' (minimum '+e.minimum+')':'')+(e.maximum!==undefined?' (maximum '+e.maximum+')':'')+'.';
   case 'benefit-rolls':return ({'retain-term':'Retain this term’s Benefit roll.','lose-term':'Lose this term’s Benefit roll.','lose-all':'Lose all Benefit rolls.','retain-one':'Retain one Benefit roll.'})[e.mode]??(e.dice?(e.value<0?'-':'+')+e.dice:signed(e.value))+' Benefit rolls.';
   case 'modifier':return words(e.target)+' DM '+signed(e.value)+(e.scope==='all'?' for all applicable rolls':e.scope==='next'||e.scope==='one'?' for the next applicable roll':'')+(e.career?' ('+words(e.career)+' career)':'')+'.';
   case 'cash':return 'Cash '+(e.dice?e.dice+' × ':'')+signed(e.value??e.multiplier??0)+' credits.';
   case 'debt':return 'Debt '+signed(e.value??0)+' credits.';
   case 'benefit':return 'Benefit: '+e.name+(e.value?' × '+e.value:'')+(e.dice?' ('+e.dice+')':'')+'.';
   case 'injury':return 'Resolve the injury'+(e.result?' result '+e.result:' table')+'.';
   case 'promotion':return e.mode==='automatic'?'Automatic promotion.':'Promotion opportunity at the next check.';
   case 'parole':return e.mode==='reset'?'Reset the parole target.':'Parole target '+signed(e.value)+'.';
   case 'core-life-benefit-bonus':return 'Gain the life-event Benefit bonus.';
   case 'table-roll':return 'Resolve the '+words(e.table)+(e.career?' for '+words(e.career):'')+' table'+(e.dice?' ('+e.dice+')':'')+'.';
   default:return careerOutcomeSummary([e]);
  }
 }).join(' ');
}
