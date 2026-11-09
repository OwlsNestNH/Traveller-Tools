// Presentation only. Core 2022 p.18 replaces the ordinary training roll only
// in the first career; later-career basic training is followed by that roll.
export function trainingContext(state){
 const record=state.character?.careers?.[state.active];
 if(!(state.active>0)||record?.terms!==0)return null;
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
