// Presentation only: name the already-projected choices without changing effects or audit labels.
function effectLabel(effect){
 if(effect.kind==='skill'&&typeof effect.name==='string')return effect.name+(effect.mode==='set'&&Number.isInteger(effect.value)?' '+effect.value:'');
 if(effect.kind==='choice'&&Array.isArray(effect.options)){
  const labels=effect.options.map(option=>effectsLabel(option.effects));return labels.every(Boolean)?labels.join(' or '):null;
 }
 if(effect.kind==='skill-choice'&&effect.scope==='psionic-talents')return 'Psionic talent'+(effect.mode==='set'&&Number.isInteger(effect.value)?' '+effect.value:'')+' (choose)';
 return null;
}
function effectsLabel(effects){if(!Array.isArray(effects)||!effects.length)return null;const labels=effects.map(effectLabel);return labels.every(Boolean)?labels.join(' + '):null;}
export function choiceLabel(option){
 if(!/^Basic-training option [0-9]+$/.test(option.label??''))return option.label??'Choose an outcome';
 return effectsLabel(option.effects)??option.label;
}

export function skillChoiceProgress(choice,esc){
 if(!choice?.selected?.length)return '';
 return '<p class="notice">Already awarded: '+choice.selected.map(esc).join(', ')+'. Remaining skill awards: '+esc(choice.count??1)+'. Do not add the earlier awards again.</p>';
}
