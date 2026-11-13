// Presentation only. New-revision Core entry follows the selected basic-only
// interpretation; historical saves retain their recorded continuation.
export function trainingContext(state){
 const record=state.character?.careers?.[state.active];
 if(state.stage==='training'&&record?.academyServiceTraining==='pending')return {title:'GM option: Academy Service Skills',description:'Your enabled house option grants one Service Skills roll in the first term after Academy. The roll uses normal skill gains and limits. This is separate from graduation awards and is not the default Core rule.'};
 if(state.stage==='training'&&state.trainingNext==='end-term')return {title:'Advancement training',description:'Successful advancement grants this additional training roll, separately from any rank award and the regular training at the start of the term. Core Rulebook Update 2022, p. 18.'};
 if(state.stage==='training'&&record?.terms>0)return {title:'Regular term training',description:'Start this term with one regular training roll. Event awards, rank awards and successful-advancement training are separate. Choose a table below. Core Rulebook Update 2022, p. 18.'};
 if(!(state.active>0)||record?.terms!==0)return null;
 if(state.stage==='effect-choice'&&state.pendingChoice?.basicTraining&&state.effectNext==='survival')return {title:'Choose a basic-training skill',description:'Choose one basic-training skill at level 0, then continue to survival. This tool uses basic training in place of the ordinary entry-term training roll. Any earned advancement training remains separate. Core Rulebook Update 2022, p. 18 (selected interpretation).'};
 if(state.stage==='effect-choice'&&state.effectNext==='new-career-training'&&state.pendingChoice?.options?.length&&state.pendingChoice.options.every(option=>/^Basic-training option [0-9]+$/.test(option.label??'')))return {
  title:'Choose a basic-training skill',
  description:'Choose one basic-training skill at level 0. After this, you will also get the regular training roll for your new career. Core Rulebook Update 2022, p. 18.'
 };
 if(state.stage==='training'&&state.trainingNext!=='end-term')return {
  title:'Regular term training',
  description:'Basic training is complete. Because this is a later career, you also get this term’s regular training roll. Choose a table below. Core Rulebook Update 2022, p. 18.'
 };
 return null;
}
