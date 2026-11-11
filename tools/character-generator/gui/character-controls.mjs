import {physicalDiceSetting} from './physical-dice.mjs';
// Presentation only. Corrections continue through the existing audited commands.
export function correctionFields(state){
 const c=state.character;
 return [
  ...(state.stage==='statistics'?state.pool.map((p,index)=>({id:'pool.'+index,name:p.key+' raw score',value:p.base,field:'pool',index,min:1,max:18})):[]),
  ...Object.entries(c.stats).filter(([key])=>!(c.species==='aezorgh'&&key==='CHA')).map(([key,value])=>({id:'stat.'+key,name:key,value,field:'stat.'+key,min:0,max:40})),
  {id:'age',name:'Age',value:c.age,field:'age',min:0,max:500},
  {id:'cash',name:'Cash (Cr)',value:c.cash,field:'cash',min:0,max:100000000},
  {id:'debt',name:'Debt (Cr)',value:c.debt,field:'debt',min:0,max:100000000},
  {id:'custom',name:'A custom characteristic',min:0,max:40}
 ];
}
export function replaceableRolls(log){
 return log.filter(entry=>!['gm-replay','restore'].includes(entry.type)).flatMap(entry=>(entry.rolls??[]).map((roll,index)=>({
  id:entry.number+':'+index,revision:entry.number,rollIndex:index,...roll,
  name:roll.label+' · ['+roll.values.join(', ')+']'+(roll.kept&&roll.kept.length!==roll.values.length?' → keep ['+roll.kept.join(', ')+']':'')+' = '+roll.total+' (action '+entry.number+')'
 }))).reverse();
}
export function extraCharacteristicsView(state,catalog,{esc,button,options}){
 if(['identity','statistics'].includes(state.stage))return '';
 const extras=catalog.extraStats.filter(extra=>!Object.hasOwn(state.character.stats,extra.id)&&!(extra.id==='PSI'&&(state.optionalPsiRequiresTesting||state.psiActivationRequiresTesting)&&state.config.extras.includes('PSI')));
 const canAdd=extras.length&&state.pending?.kind!=='core-life-decision';
 if(!canAdd&&!state.canStartPsionicTraining)return '';
 return '<details id="additional-characteristics"><summary>Add another characteristic</summary>'+(canAdd?'<p class="tiny">Add an extra you did not choose at the start. It stays outside the six-score total. PSI grants potential, not trained talents.</p>'+(state.optionalAezorghCharisma&&state.character.species==='aezorgh'?'<p class="tiny">For a Vargr campaign, add Charisma manually: CHA is half SOC, rounded down (JTAS Vol. 11 p. 67). No dice are rolled.</p>':'')+(state.config.flatLuck?'<p class="tiny">House rule: adding Luck starts it at 6 without a roll.</p>':'')+'<label>Characteristic<select id="extra-stat">'+options(extras,'')+'</select></label>'+button('Add this characteristic','add-extra','quiet'):'')+(state.canStartPsionicTraining?'<h3>Psionic training</h3><p class="tiny">Institute training needs a referee ruling on access, payment and elapsed time.</p>'+button('Arrange psionic training','begin-psionic-training','quiet'):'')+'</details>';
}
export function gmControlsView(state,log,{esc,options}){
 if(state.stage==='identity')return '';
 const fields=correctionFields(state),rolls=replaceableRolls(log),restorePoints=log.slice(0,-1).map(entry=>({id:String(entry.number),name:'Action '+entry.number+' · '+entry.type.replaceAll('-',' ')})).reverse();
 return '<details id="gm-controls"><summary>GM result controls</summary>'+(state.stage==='statistics'?physicalDiceSetting(state):'')+'<label class="check"><input id="gm-psi-mode" type="checkbox" '+(state.config.psiGm?'checked':'')+'><span>PSI: enable GM activation<small>Set PSI without enabling other corrections. Checking this box does not roll PSI, grant training or talents. Unchecking retains the score and history.</small></span></label><label class="check"><input id="gm-toggle" type="checkbox" '+(state.config.gm?'checked':'')+'><span>Enable corrections</span></label>'+(state.config.gm||state.config.psiGm?'<label class="check"><input id="gm-psi-testing" type="checkbox" '+(state.config.psiTestingWithoutEvent?'checked':'')+'><span>Allow PSI testing without an event<small>GM house option. Costs, institute access and two-week timing still apply. Testing is separate from training.</small></span></label>':'')+(state.config.gm?'<label class="check"><input id="gm-academy-training" type="checkbox" '+(state.config.academyServiceSkill?'checked':'')+' '+(state.character.careers?.length?'disabled':'')+'><span>Allow Service Skill choice in the first term after Academy<small>House option, off by default. After a completed Core military Academy term, add one Service Skills roll when the first career would normally skip it. Matching Army, Marine or Navy career only; no extra roll in later careers. Set before career entry. The roll uses normal skill gains and limits. Graduation awards are unchanged.</small></span></label><p class="tiny">Every change keeps the old result and your reason in the log.</p><label>What would you like to do?<select id="gm-task"><option value="value">Change a value</option><option value="roll" '+(!rolls.length?'disabled':'')+'>Replace a roll</option><option value="restore" '+(!restorePoints.length?'disabled':'')+'>Restore an earlier step</option></select></label><form id="gm-value-form"><label>Change<select id="gm-field">'+options(fields,fields[0].id)+'</select></label><label id="gm-custom-label" hidden>Characteristic code<input id="gm-custom" maxlength="8" pattern="[A-Za-z][A-Za-z0-9]{1,7}" placeholder="e.g. REP"></label><label>New value<input id="gm-value" type="number" step="1" required></label><p id="gm-current-value" class="tiny"></p><label>Reason<input id="gm-reason" maxlength="300" required placeholder="Why is this changing?"></label><button id="gm-save-correction" type="submit" class="quiet">Save correction</button></form><form id="gm-roll-form" hidden><label>Which roll?<select id="gm-roll-choice">'+options(rolls,rolls[0]?.id)+'</select></label><fieldset id="gm-replacement-dice"><legend>Replacement dice</legend><div id="gm-dice-inputs" class="gm-dice-inputs"></div></fieldset><label>Reason<input id="gm-roll-reason" maxlength="300" required placeholder="Why is this roll changing?"></label><p class="warning tiny">This returns the character to this roll. Later progress is undone, but stays in the log.</p><details id="gm-replay-explanation"><summary><span aria-hidden="true">ⓘ</span> How roll replacement works</summary><p class="tiny">Earlier dice in the same action are kept. Later rolls in that action are generated again. All original actions remain in the detailed log.</p></details><button id="gm-replace-roll" type="submit" class="quiet">Replace this roll</button></form><form id="gm-restore-form" hidden><label>Return to<select id="gm-restore-choice" required>'+options(restorePoints,restorePoints[0]?.id)+'</select></label><p class="warning tiny">Later progress is undone. The full log keeps every action.</p><button id="gm-restore-step" type="submit" class="quiet">Restore this step</button></form>':'')+'</details>';
}
export function syncCorrectionField(state,$){
 const select=$('#gm-field');if(!select)return;
 const field=correctionFields(state).find(field=>field.id===select.value);if(!field)return;
 const custom=field.id==='custom',input=$('#gm-value');
 $('#gm-custom-label').hidden=!custom;$('#gm-custom').disabled=!custom;$('#gm-custom').required=custom;
 input.value=field.value??'';input.min=field.min;input.max=field.max;
 $('#gm-current-value').textContent=custom?'Use a short code for the characteristic.':'Current value: '+field.value;
}
export function syncReplacementDice(log,$,esc){
 const select=$('#gm-roll-choice');if(!select)return;
 const roll=replaceableRolls(log).find(roll=>roll.id===select.value);
 $('#gm-dice-inputs').innerHTML=roll?roll.values.map((value,index)=>'<label>Die '+(index+1)+'<input data-gm-die type="number" min="1" max="6" step="1" required value="'+esc(value)+'"></label>').join(''):'';
}
export function syncCorrectionTask($){
 const select=$('#gm-task');if(!select)return;
 $('#gm-value-form').hidden=select.value!=='value';$('#gm-roll-form').hidden=select.value!=='roll';$('#gm-restore-form').hidden=select.value!=='restore';
}
export function correctionPayload(state,$){
 const field=correctionFields(state).find(field=>field.id===$('#gm-field').value);
 if(!field)throw new Error('Choose a value to change.');
 return {field:field.id==='custom'?'stat.'+$('#gm-custom').value.toUpperCase():field.field,value:Number($('#gm-value').value),...(field.index!==undefined?{index:field.index}:{}),reason:$('#gm-reason').value};
}
export function replacementPayload(log,$){
 const roll=replaceableRolls(log).find(roll=>roll.id===$('#gm-roll-choice').value);
 if(!roll)throw new Error('Choose a recorded roll.');
 return {revision:roll.revision,rollIndex:roll.rollIndex,values:[...$('#gm-dice-inputs').querySelectorAll('[data-gm-die]')].map(input=>Number(input.value)),reason:$('#gm-roll-reason').value};
}
