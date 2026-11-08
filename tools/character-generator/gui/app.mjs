import { call } from './client.mjs';
const exportSession=session=>JSON.stringify(session,null,2);
const sourceLabel=(source,page)=>(catalog?.sources?.[source]?.title??source)+' · p. '+page;
const $=selector=>document.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key='traveller-character-generator.v1';
let session,projection,catalog,busy=false,selectedCareer='',effects=[],storageWarning='',operationGeneration=0,recoveryRaw=null;
const stageNames={'education-skill':'Choose your study skills','education-service':'Choose academy service awards','education-event':'Your education term','education-check':'Demonstrate what you learned','education-graduation':'Graduation','preterm-commission':'Education commission opportunity',identity:'Start your Traveller',statistics:'Roll and place characteristics',background:'Choose background skills',precareer:'Before your career',career:'Choose your next career','failed-entry':'Choose a new direction','book-step':'Resolve a source step',survival:'Will you make it through?',advancement:'Your career develops',training:'Choose a training table','effect-choice':'Make a life-path choice','skill-choice':'Choose your new skill','term-end':'The end of a term',benefits:'What you take with you',finish:'Your Traveller is ready to review',ageing:'The passing years',deceased:'The end of a life path'};
const button=(label,action,cls='',attributes='')=>'<button type="button" data-action="'+action+'" class="'+cls+'" '+attributes+'>'+label+'</button>';
const options=(list,value)=>list.map(x=>'<option value="'+esc(x.id??x)+'" '+((x.id??x)===value?'selected':'')+'>'+esc(x.name??x)+'</option>').join('');
function notify(message,error=false){$('#message').className=error?'error':'';$('#message').textContent=message;}
function updateRecovery(){
 const region=$('#recovery');region.hidden=recoveryRaw===null;
}
function setBusy(value){
 busy=value;
 if(value){for(const el of document.querySelectorAll('button,input[type=file]'))if(!el.disabled){el.dataset.busyDisabled='true';el.disabled=true;}}
 else {for(const el of document.querySelectorAll('[data-busy-disabled]')){el.disabled=false;delete el.dataset.busyDisabled;}}
}
function persist(){
 if(recoveryRaw!==null){storageWarning='Your unreadable stored draft is preserved. This new draft is only in memory. Save a file, or use the recovery controls to replace the stored draft.';return;}
 try{localStorage.setItem(key,exportSession(session));storageWarning='';}
 catch{storageWarning='This browser could not save the draft. Use Save character & log to keep a backup.';}
}
function focusAfterAction(previousStage,focused){
 let target;
 if(previousStage===projection.state.stage){
  if(focused.id)target=document.getElementById(focused.id);
  if(!target&&focused.action)target=[...document.querySelectorAll('[data-action]')].find(el=>el.dataset.action===focused.action&&!el.disabled);
 }
 if(!target||target.disabled)target=$('#step-title');target?.focus();
}
async function send(type,payload={}){
 if(busy)return false;
 const token=operationGeneration,previousStage=projection.state.stage;
 const focused={id:document.activeElement?.id,action:document.activeElement?.dataset.action};
 setBusy(true);
 try{
  const result=await call({operation:'command',session,command:{type,payload},id:crypto.randomUUID(),expectedRevision:projection.revision});
  if(token!==operationGeneration)return false;
  if(!result.ok)throw new Error(result.error.message);
  session=result.session;projection=result;effects=[];persist();render();focusAfterAction(previousStage,focused);notify(storageWarning||result.log.at(-1).summary,!!storageWarning);return true;
 }catch(error){if(token===operationGeneration)notify(error.message,true);return false;}
 finally{if(token===operationGeneration)setBusy(false);}
}
function selected(form,name){return [...form.querySelectorAll('input[name="'+name+'"]:checked')].map(e=>e.value);}
function setupView(){
 const s=projection.state;
 return '<form id="setup-form"><div class="form-grid"><label class="wide">Traveller name<input name="name" maxlength="80" autocomplete="off" placeholder="What will they call you?"></label><label>Species / society<select name="species">'+options(catalog.species,'human')+'</select></label><label>Upbringing<select name="culture"><option value="native">Native society</option><option value="imperial">Imperial upbringing</option></select><small>Culture controls which career paths appear.</small></label><label>Gender<select name="gender"><option value="">Not specified</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option></select><small>Some published Aslan assignments have restrictions.</small></label><label>Homeworld<input name="homeworld" maxlength="160" placeholder="Optional name or UWP"></label></div><fieldset><legend>Characteristic options</legend><div class="form-grid"><label>Boon rolls<select name="boons">'+[0,1,2,3,4,5,6].map(n=>'<option value="'+n+'">'+n+' of six rolls</option>').join('')+'</select><small>House option. First N rolls gain one extra die; discard the lowest. Place or swap compatible scores afterwards.</small></label><div><label class="check"><input type="checkbox" name="allocation" checked><span>Let the player place or swap scores</span></label><label class="check"><input type="checkbox" name="minimumReroll" checked><span>Allow reroll below a base total of 43</span></label><p class="tiny">The threshold uses the six base scores before species modifiers. Extra characteristics do not count.</p></div></div></fieldset><fieldset><legend>Optional extra characteristics</legend><div class="options-list">'+catalog.extraStats.map(x=>'<label class="check"><input type="checkbox" name="extras" value="'+x.id+'"><span>'+esc(x.name)+' ('+x.id+')<small>'+esc(x.source)+(x.note?' · '+esc(x.note):'')+'</small></span></label>').join('')+'</div><p class="tiny">PSI is shown only when rolled or granted by the rules. Required species characteristics are handled separately.</p></fieldset><fieldset><legend>GM controls</legend><label class="check"><input name="gm" type="checkbox"><span>Enable GM result changes. Every correction is logged.</span></label><label class="check"><input name="zhodaniPsi" type="checkbox"><span>Use the Zhodani Intendant / Noble PSI option<small>Requires GM mode and a Zhodani Traveller. Source: Aliens 2026 p. 254. PSI uses the published 1D table; SOC is rolled afterwards.</small></span></label></fieldset><div class="actions"><button type="submit">Begin character</button></div></form>';
}
function statCards(state,pool=false){
 const entries=pool?state.pool.map(p=>[p.key,p.base+p.adjustment,p]):Object.entries(state.character.stats).map(([k,v])=>[k,v,null]);
 return '<div class="stats">'+entries.map(([code,value,p])=>'<div class="stat"><span class="code">'+esc(code)+'</span><strong>'+value+'</strong><span>'+(p?'Base '+p.base+' · '+(p.adjustment>=0?'+':'')+p.adjustment+' species':('DM '+(state.statDMs[code]>=0?'+':'')+state.statDMs[code]))+'</span>'+(p?'<span>'+p.count+'D'+(p.boon?' + boon':'')+'</span>':'')+'</div>').join('')+'</div>';
}
function statisticsView(state){
 let html='<p>Roll a set, then decide where each compatible score belongs. All rerolls and swaps stay in the action log.</p>';
 if(!state.pool.length)return html+button('Roll six characteristics','roll-statistics');
 html+=statCards(state,true)+'<p class="total">Base total: '+state.rollTotal+'</p><p class="help">Reroll threshold: 43. Species modifiers and extra characteristics are excluded.</p>';
 if(state.config.allocation||state.config.gm)html+='<div class="inline-fields"><label>Swap this score<select id="swap-a">'+state.pool.map((p,i)=>'<option value="'+i+'">'+p.key+' · base '+p.base+'</option>').join('')+'</select></label><label>With this score<select id="swap-b">'+state.pool.map((p,i)=>'<option value="'+i+'" '+(i===1?'selected':'')+'>'+p.key+' · base '+p.base+'</option>').join('')+'</select></label>'+button('Swap scores','swap-statistics','quiet')+'</div><p class="tiny">Mixed alien dice formulas can only be swapped within the same dice count unless the GM overrides them.</p>';
 return html+'<div class="actions">'+button('Keep these characteristics','accept-statistics')+button('Reroll this set','roll-statistics','quiet',(!state.config.gm&&(!state.config.minimumReroll||state.rollTotal>=43)?'disabled':''))+'</div>';
}
function backgroundView(state){
 return '<p>Choose <strong>'+state.backgroundRemaining+'</strong> background skills. Each begins at level 0.</p><form id="background-form"><div class="options-list">'+state.backgroundOptions.filter(name=>!Object.hasOwn(state.character.skills,name)).map(name=>'<label class="check"><input type="checkbox" name="skills" value="'+esc(name)+'"><span>'+esc(name)+'</span></label>').join('')+'</div><div class="actions"><button type="submit">Accept background skills</button></div></form>';
}
function preCareerView(state){
 return '<p>Core University and military academies include entry, skills, events and graduation. Companion paths and species-specific exceptions use explicit book-assisted steps.</p><div class="choice-list">'+catalog.precareers.map(p=>button('<span><strong>'+esc(p.name)+'</strong><small>'+esc(sourceLabel(p.source,p.page))+'</small></span>','precareer','choice','data-id="'+p.id+'" '+(p.maxTerm&&state.character.terms>=p.maxTerm?'disabled':''))).join('')+'</div><div class="actions">'+button('Go straight to careers','skip-precareer','quiet')+'</div>';
}
function careerView(state){
 const list=state.careerChoices;const c=list.find(c=>c.id===selectedCareer);
 if(c){
 return button('Back to career list','career-list','quiet')+'<h3>'+esc(c.name)+'</h3><p class="source">'+esc(sourceLabel(c.source,c.page))+'</p>'+(c.sourceConflict?'<p class="warning">'+esc(c.sourceConflict)+'</p>':'')+'<label>Assignment<select id="career-assignment">'+options(c.assignments,c.assignments[0].id)+'</select></label><p class="help">Qualification: '+(c.qualification?esc(c.qualification.stat)+' '+c.qualification.target+'+':'automatic')+'. The engine records the roll and modifiers.</p>'+button('Attempt this career','career','',c.disabled?'disabled':'')+(c.reason?'<p>'+esc(c.reason)+'</p>':'');
 }
 return '<p>Choose a career for term '+(state.character.terms+1)+'. Options follow your species and upbringing.</p><div class="choice-list">'+list.map(c=>button('<span><strong>'+esc(c.name)+'</strong><small>'+esc(sourceLabel(c.source,c.page))+(c.reason?' · '+esc(c.reason):'')+'</small></span>','select-career','choice','data-id="'+c.id+'" '+(c.disabled?'disabled':''))).join('')+'</div><div class="actions">'+button('Finish character','finish','quiet')+(state.canChooseEducation?button('Review education options','open-precareer','quiet'):'')+'</div>';
}
function effectView(effect,index){
 const skill=effect.kind==='skill',stat=effect.kind==='stat';
 return '<div class="effect" data-effect="'+index+'"><div class="form-grid"><label>Effect<select data-field="kind">'+options([{id:'skill',name:'Skill'},{id:'stat',name:'Characteristic change'},{id:'cash',name:'Cash'},{id:'debt',name:'Debt'},{id:'relationship',name:'Contact / relationship'},{id:'benefit',name:'Benefit'}],effect.kind)+'</select></label><label>Name'+(skill?'<input data-field="name" list="skill-names" value="'+esc(effect.name)+'" placeholder="Skill or Skill (specialisation)">':stat?'<select data-field="name">'+options(Object.keys(projection.state.character.stats),effect.name)+'</select>':'<input data-field="name" value="'+esc(effect.name)+'">')+'</label><label>Value / change<input data-field="value" type="number" value="'+effect.value+'" min="-10000000" max="10000000" step="1"></label>'+ (skill?'<label>Skill award<select data-field="mode">'+options([{id:'increase',name:'Increase by'},{id:'set',name:'Gain at least this level'}],effect.mode)+'</select></label>':effect.kind==='relationship'?'<label>Relationship<select data-field="role">'+options(['Contact','Ally','Rival','Enemy'],effect.role)+'</select></label>':'')+'</div>'+button('Remove effect','remove-effect','quiet','data-index="'+index+'"')+'</div>';
}
function bookView(state){
 const p=state.pending;

 return '<p class="warning"><strong>Book required for this step.</strong> This is an explicit manual source lookup, not an automated rule result.</p><h3>'+esc(p.label)+'</h3><p class="source">'+esc(sourceLabel(p.source,p.page))+'</p><p>Read the indicated outcome. Record its effects below, including any choices or follow-up checks in your notes. Do not paste source-book passages.</p><div id="effect-list">'+effects.map(effectView).join('')+'</div>'+button('Add an effect','add-effect','quiet')+'<datalist id="skill-names">'+catalog.skills.flatMap(base=>[base,...(catalog.skillSpecialities?.[base]??[]).map(speciality=>base+' ('+speciality+')')]).map(x=>'<option value="'+esc(x)+'"></option>').join('')+'</datalist><label style="margin-top:20px">Outcome notes<textarea id="book-note" rows="3" maxlength="500" placeholder="Your decision, check totals and consequences"></textarea></label>'+(p.kind==='precareer'?'<div class="inline-fields"><label>Years elapsed<input id="book-years" type="number" value="4" min="0" max="16"></label><label class="check"><input id="book-graduated" type="checkbox"><span>Graduated</span></label></div>':'')+(p.kind==='species-setup'&&state.character.species==='aslan'?'<label>Family position<select id="birth-order"><option value="">Choose from source rules</option><option value="first-son">First son</option><option value="second-son">Second son / later son</option><option value="daughter">Daughter</option></select></label>':'')+(p.kind==='mishap'?'<label class="check"><input id="book-leave" type="checkbox" checked><span>Leave career because of this mishap</span></label><label class="check"><input id="book-keep-benefit" type="checkbox"><span>The source explicitly preserves this term Benefit roll</span></label>':'')+(p.kind==='education-entry-rights'?'<label class="check"><input id="education-auto-entry" type="checkbox"><span>The referee permits automatic entry, with no first-term commission</span></label>':'')+(state.education!==undefined&&state.education!==null?'<h3>Education consequences</h3><label class="check"><input id="education-no-graduation" type="checkbox"><span>The source prevents graduation this term</span></label><label>Required next career, only if the source specifies one<select id="education-next-career"><option value="">No required career</option>'+options(catalog.careers,'')+'</select></label>':'')+'<label class="check"><input id="book-confirm" type="checkbox"><span>I checked the source and recorded all effects.</span></label><div class="actions">'+button('Record outcome and continue','resolve-book')+'</div>';
}
function stageView(state){
 switch(state.stage){
 case 'identity':return setupView();
 case 'statistics':return statisticsView(state);
 case 'background':return backgroundView(state);
 case 'precareer':return preCareerView(state);
 case 'career':return careerView(state);
 case 'education-event':return '<p>Your initial education awards are recorded. Roll one pre-career event before graduation.</p>'+button('Roll education event','education-event');
 case 'education-graduation':return '<p>Roll your graduation check. Your initial skills are retained even if you do not graduate.</p>'+button('Roll graduation','education-graduation');
 case 'education-skill':return '<p>Choose a skill from your study options. For specialised university subjects, include the speciality to keep for graduation, for example Science (physics). Animals is limited to training or veterinary.</p><p class="help">Award: level '+state.pendingChoice.value+'. Available subjects: '+state.educationOptions.map(o=>esc(o.name)).join(', ')+'.</p><label>Study skill<input id="education-skill" list="education-skills" maxlength="80"></label><datalist id="education-skills">'+state.educationOptions.map(o=>'<option value="'+esc(o.name)+'"></option>').join('')+'</datalist>'+button('Record study skill','education-skill');
 case 'education-service':return '<p>Choose '+(state.pendingChoice.count-state.pendingChoice.picked.length)+' more distinct service skill'+(state.pendingChoice.count-state.pendingChoice.picked.length===1?'':'s')+' to gain at level 1.</p><div class="choice-list">'+state.pendingChoice.options.filter(n=>!state.pendingChoice.picked.includes(n)).map(n=>button(esc(n),'education-service','choice','data-name="'+esc(n)+'"')).join('')+'</div>';
 case 'education-check':return '<p>Choose a skill learned or improved during this education term. Success increases the skill and records the tutor as a Rival.</p><label>Skill<select id="education-check-skill">'+options(state.educationCheckSkills,state.educationCheckSkills[0])+'</select></label>'+button('Roll the study challenge','education-check');
 case 'preterm-commission':return '<p>Your education allows a commission attempt before this career term. The award and any dice are recorded separately from ordinary advancement.</p><div class="actions">'+button('Attempt education commission','education-commission')+button('Continue without it','skip-education-commission','quiet')+'</div>';
 case 'failed-entry':return '<p>The attempted career did not accept you. Choose the fallback available to your society.</p><div class="actions">'+button('Use culture fallback','fallback')+button('Enter the draft','draft','quiet',state.draftUsed?'disabled':'')+'</div>';
 case 'book-step':return bookView(state);
 case 'effect-choice':return '<p>Choose the outcome you want to apply.</p><div class="choice-list">'+state.pendingChoice.options.map((option,index)=>button(esc(option.label),'choose-effect','choice','data-index="'+index+'"')).join('')+'</div>';
 case 'skill-choice':return '<p>'+esc(state.pendingChoice.label??'Choose the skill awarded by this result.')+'</p><p class="help">'+esc(state.pendingChoice.scope==='existing'?'Choose a skill you already have.':'Specialised skills need a speciality, for example Gun Combat (slug).')+'</p><label>Skill or specialisation<input id="award-skill" list="all-skills" maxlength="80" placeholder="e.g. Engineer (power)"></label>'+button('Accept skill','choose-skill');
 case 'training':return '<p>Choose an available training table. The rules engine will roll and apply its result.</p><div class="choice-list">'+state.trainingOptions.map(t=>button(esc(t.name),'training','choice','data-table="'+t.id+'"')).join('')+'</div>';
 case 'ageing':return '<p>Your Traveller has reached the next ageing checkpoint. The engine applies the species schedule and modifiers.</p>'+button('Roll ageing','ageing');
 case 'deceased':return '<p>This life path ended in death. The full record remains saved. A GM can restore an earlier action and record an explicit correction.</p>';
 case 'survival':return '<p>Training is recorded. Roll to see whether you complete this term safely.</p>'+button('Roll survival','survival');
 case 'advancement':return '<p>Your term events are recorded. Make the advancement check for your assignment.</p><div class="actions">'+button('Roll advancement','advancement')+button('Attempt a commission','commission','quiet')+'</div>';
 case 'term-end':{
 const record=state.character.careers[state.active];
 return '<p>You are now <strong>'+state.character.age+'</strong>. '+(record.forcedExit?'This career must end.':record.forcedStay?'Your natural 12 requires another term.':'Continue in this career or collect your benefits.')+'</p><div class="actions">'+button('Continue this career','continue-career','',record.forcedExit?'disabled':'')+button('Leave and take benefits','leave-career','quiet',record.forcedStay?'disabled':'')+'</div>';
 }
 case 'benefits':return '<p><strong>'+state.character.careers[state.active].benefitRolls+'</strong> benefit rolls remain. Cash rolls used across all careers: '+state.cashRolls+' / '+(state.cashLimit===999?'unlimited':state.cashLimit)+'.</p><div class="actions">'+button('Roll a material benefit','material-benefit')+button('Roll a cash benefit','cash-benefit','quiet',state.cashRolls>=state.cashLimit?'disabled':'')+'</div>';
 case 'finish':return '<p>Save or print your character and review the source-assisted steps with your referee. The complete action log is included.</p><p class="warning">This preview does not certify every source rule. It records which steps were manually resolved.</p><h3>Source-assisted coverage</h3><ul>'+state.coverage.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>';
 default:return '<p>Unsupported stage. Preserve your save and log.</p>';
 }
}
function sheetView(state){
 const c=state.character;

 return '<p class="eyebrow">LIVE CHARACTER RECORD</p><h2>'+esc(c.name||'Your Traveller')+'</h2><p class="sheet-meta">'+esc(catalog.species.find(s=>s.id===c.species)?.name??c.species)+(c.homeworld?' · '+esc(c.homeworld):'')+'</p><div class="sheet-facts"><span>Age<strong>'+c.age+'</strong></span><span>Terms<strong>'+c.terms+'</strong></span><span>Cash<strong>Cr'+c.cash.toLocaleString()+'</strong></span><span>Debt<strong>Cr'+c.debt.toLocaleString()+'</strong></span></div>'+(Object.keys(c.stats).length?'<div class="sheet-section">'+statCards(state)+'</div>':'')+'<div class="sheet-section"><h3>Skills</h3>'+(Object.keys(c.skills).length?'<ul class="compact-list">'+Object.entries(c.skills).sort(([a],[b])=>a.localeCompare(b)).map(([name,level])=>'<li>'+esc(name)+' <strong>'+level+'</strong></li>').join('')+'</ul>':'<p class="help">Your skills will appear here.</p>')+'</div><div class="sheet-section"><h3>Life path</h3>'+(c.careers.length?'<ol class="compact-list">'+c.careers.map(r=>'<li>'+esc(catalog.careers.find(x=>x.id===r.id)?.name??r.id)+' · '+r.terms+' terms · rank '+r.rank+'</li>').join('')+'</ol>':'<p class="help">Your story is just beginning.</p>')+'</div>'+(c.relationships.length?'<div class="sheet-section"><h3>People</h3><ul class="compact-list">'+c.relationships.map(p=>'<li>'+esc(p.role)+': '+esc(p.name)+'</li>').join('')+'</ul></div>':'')+(c.benefits.length?'<div class="sheet-section"><h3>Benefits</h3><ul class="compact-list">'+c.benefits.map(b=>'<li>'+esc(b.name)+' x '+b.quantity+'</li>').join('')+'</ul></div>':'')+(c.educations?.length?'<div class="sheet-section"><h3>Education</h3><ul class="compact-list">'+c.educations.map(e=>'<li>'+esc(catalog.precareers.find(p=>p.id===e.id)?.name??e.id)+': '+esc(e.completed?(e.graduation?.honours?'graduated with honours':e.graduation?.graduated?'graduated':'did not graduate'):'in progress')+'</li>').join('')+'</ul></div>':'')+(c.traits?.length?'<div class="sheet-section"><h3>Traits</h3><ul class="compact-list">'+c.traits.map(t=>'<li>'+esc(typeof t==='string'?t:t.name??t.description??JSON.stringify(t))+'</li>').join('')+'</ul></div>':'')+(c.historyNotes?.length?'<div class="sheet-section"><h3>History notes</h3><ul class="compact-list">'+c.historyNotes.map(n=>'<li>'+esc(n)+'</li>').join('')+'</ul></div>':'')+(c.futureConditions?.length?'<div class="sheet-section"><h3>Future conditions to review</h3><ul class="compact-list">'+c.futureConditions.map(n=>'<li>'+esc(n.text??n.reason??n.label??JSON.stringify(n))+'</li>').join('')+'</ul></div>':'')+'<details><summary>Notes & connections</summary><label>Background notes<textarea id="character-notes" rows="5" maxlength="10000">'+esc(c.notes)+'</textarea></label>'+button('Save notes','save-notes','quiet')+'<h3>Add a connection</h3><label>Other Traveller<input id="connection-person" maxlength="80"></label><label>Skill<input id="connection-skill" list="all-skills" maxlength="80"></label><label>What happened?<input id="connection-note" maxlength="300"></label>'+button('Record connection','connection','quiet')+'</details><details><summary>Additional characteristics</summary><p class="tiny">Optional campaign characteristics stay outside the six-stat total.</p><label>Characteristic<select id="extra-stat">'+options(catalog.extraStats.filter(e=>!Object.hasOwn(c.stats,e.id)),'PSI')+'</select></label>'+button('Roll / add characteristic','add-extra','quiet')+'</details><details><summary>GM result controls</summary><label class="check"><input id="gm-toggle" type="checkbox" '+(state.config.gm?'checked':'')+'><span>Allow GM changes. Always logged.</span></label>'+(state.config.gm?'<label>Field<select id="gm-field">'+options([...Object.keys(c.stats).map(k=>({id:'stat.'+k,name:k})),{id:'age',name:'Age'},{id:'cash',name:'Cash'},{id:'debt',name:'Debt'},...(state.stage==='statistics'&&state.pool.length?[{id:'pool',name:'A base rolled score'}]:[]),{id:'custom',name:'Custom characteristic'}],'age')+'</select></label><label>Custom characteristic code<input id="gm-custom" maxlength="8" placeholder="e.g. REP"></label><label>Base score position (0-5)<input id="gm-index" type="number" min="0" max="5" value="0"></label><label>New value<input id="gm-value" type="number" min="0" value="7" step="1"></label><label>Reason<input id="gm-reason" maxlength="300" placeholder="Required; recorded with old and new values"></label>'+button('Apply logged correction','gm-override','quiet')+'<h3>Replace a previous roll</h3><p class="tiny">This restores the character to that action and applies replacement dice. Later actions stay in the log but their character changes are superseded.</p><label>Original action number<input id="gm-roll-action" type="number" min="1" max="'+projection.revision+'" value="'+projection.revision+'"></label><label>Roll within that action (1 = first)<input id="gm-roll-index" type="number" min="1" value="1"></label><label>Replacement dice<input id="gm-roll-dice" placeholder="e.g. 6, 4"></label>'+button('Replace roll with logged reason','gm-replay','quiet'):'')+'</details><datalist id="all-skills">'+catalog.skills.map(x=>'<option value="'+esc(x)+'"></option>').join('')+'</datalist>';
}
function render(){
 const state=projection.state;const previousDetails=[...$('#sheet').querySelectorAll('details')].map(d=>d.open);
 $('#workspace').innerHTML='<p class="step-count">TERM '+(state.character.terms+1)+' · '+esc(state.stage.toUpperCase().replaceAll('-',' '))+'</p><h2 id="step-title" tabindex="-1">'+esc(stageNames[state.stage]??state.stage)+'</h2>'+stageView(state);
 $('#sheet').innerHTML=sheetView(state);[...$('#sheet').querySelectorAll('details')].forEach((d,i)=>d.open=previousDetails[i]??false);
 $('#action-log').innerHTML=projection.log.length?projection.log.map(e=>'<li><strong>Action '+e.number+'</strong> · '+esc(e.summary)+(e.rolls??[]).map(r=>'<div class="roll">'+esc(r.label)+': ['+r.values.join(', ')+']'+(r.values.length!==r.kept.length?' → keep ['+r.kept.join(', ')+']':'')+' = '+r.total+'</div>').join('')+(e.number<projection.revision?'<div class="log-actions">'+button('Restore after this action','restore','quiet','data-revision="'+e.number+'"')+'</div>':'')+'</li>').join(''):'<li>No actions yet. Your first choice will start the record.</li>';
}
function readEffects(){
 return [...document.querySelectorAll('[data-effect]')].map(row=>{
 const value={};row.querySelectorAll('[data-field]').forEach(input=>value[input.dataset.field]=input.dataset.field==='value'?Number(input.value):input.value);
 return value;
 });
}
document.addEventListener('click',async event=>{
 const el=event.target.closest('[data-action]');if(!el||busy)return;
 const action=el.dataset.action;
 if(action==='select-career'){selectedCareer=el.dataset.id;render();$('#step-title')?.focus();return;}
 if(action==='career-list'){selectedCareer='';render();$('#step-title')?.focus();return;}
 if(action==='add-effect'){effects=readEffects();effects.push({kind:'skill',name:'',value:1,mode:'increase',role:'Contact'});$('#effect-list').innerHTML=effects.map(effectView).join('');return;}
 if(action==='remove-effect'){effects=readEffects();effects.splice(Number(el.dataset.index),1);$('#effect-list').innerHTML=effects.map(effectView).join('');return;}
 if(action==='choose-effect')return send(action,{index:Number(el.dataset.index)});
 if(action==='choose-skill')return send(action,{name:$('#award-skill').value});
 if(action==='education-skill')return send(action,{name:$('#education-skill').value});
 if(action==='education-service')return send(action,{name:el.dataset.name});
 if(action==='education-check')return send(action,{name:$('#education-check-skill').value});
 if(action==='education-commission'||action==='skip-education-commission')return send('preterm-commission',{attempt:action==='education-commission'});
 if(action==='training')return send(action,{table:el.dataset.table});
 if(action==='swap-statistics')return send(action,{a:Number($('#swap-a').value),b:Number($('#swap-b').value)});
 if(action==='career'){const id=selectedCareer;selectedCareer='';return send(action,{id,assignment:$('#career-assignment').value});}
 if(action==='precareer')return send(action,{id:el.dataset.id});
 if(action==='draft')return send('fallback',{draft:true});
 if(action==='material-benefit'||action==='cash-benefit')return send('benefit',{cash:action==='cash-benefit'});
 if(action==='save-notes')return send('notes',{text:$('#character-notes').value});
 if(action==='connection')return send(action,{person:$('#connection-person').value,skill:$('#connection-skill').value,note:$('#connection-note').value});
 if(action==='add-extra')return send(action,{id:$('#extra-stat').value});
 if(action==='gm-replay')return send(action,{revision:Number($('#gm-roll-action').value),rollIndex:Number($('#gm-roll-index').value)-1,values:$('#gm-roll-dice').value.split(',').map(x=>Number(x.trim())),reason:$('#gm-reason').value});
 if(action==='gm-override'){const field=$('#gm-field').value;return send(action,{field:field==='custom'?'stat.'+$('#gm-custom').value.toUpperCase():field,value:Number($('#gm-value').value),index:Number($('#gm-index').value),reason:$('#gm-reason').value});}
 if(action==='restore'){if(confirm('Restore the character to this point? All later actions and rolls will remain in the log.'))return send('restore',{revision:Number(el.dataset.revision)});return;}
 if(action==='resolve-book')return send(action,{confirmed:$('#book-confirm').checked,effects:readEffects(),note:$('#book-note').value,years:$('#book-years')?Number($('#book-years').value):undefined,graduated:$('#book-graduated')?.checked,leaveCareer:$('#book-leave')?.checked,keepBenefit:$('#book-keep-benefit')?.checked,birthOrder:$('#birth-order')?.value,educationNoGraduation:$('#education-no-graduation')?.checked,educationNextCareer:$('#education-next-career')?.value,educationAutomaticEntry:$('#education-auto-entry')?.checked});
 return send(action);
});
document.addEventListener('change',event=>{
 if(event.target.id==='gm-toggle')send('gm-mode',{enabled:event.target.checked});
 if(event.target.matches('[data-field="kind"]')){effects=readEffects();$('#effect-list').innerHTML=effects.map(effectView).join('');}
});
document.addEventListener('submit',async event=>{
 if(event.target.id==='setup-form'){
  event.preventDefault();if(busy)return;const form=event.target;const values=new FormData(form);
  if(values.get('zhodaniPsi')&&(!values.get('gm')||values.get('species')!=='zhodani')){notify('The Zhodani PSI option needs GM mode and a Zhodani Traveller.',true);return;}
  if(!await send('configure',{boons:Number(values.get('boons')),minimumReroll:!!values.get('minimumReroll'),allocation:!!values.get('allocation'),extras:values.getAll('extras'),zhodaniPsi:!!values.get('zhodaniPsi')}))return;
  if(values.get('gm')&&!await send('gm-mode',{enabled:true}))return;
  await send('setup',{name:values.get('name'),species:values.get('species'),gender:values.get('gender'),culture:values.get('culture'),homeworld:values.get('homeworld')});
 }
 if(event.target.id==='background-form'){event.preventDefault();send('background',{skills:selected(event.target,'skills')});}
});
function download(name,contents,type='application/json'){
 const url=URL.createObjectURL(new Blob([contents],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);
}
$('#export').onclick=()=>download('traveller-character.json',exportSession(session));
$('#log-download').onclick=()=>download('traveller-action-log.txt',projection.log.map(e=>'ACTION '+e.number+' · '+e.summary+'\n'+e.rolls.map(r=>r.label+': '+r.values.join(', ')+'; kept '+r.kept.join(', ')+'; total '+r.total).join('\n')).join('\n\n'),'text/plain');
$('#print').onclick=()=>window.print();
$('#recovery-save').onclick=()=>{if(recoveryRaw!==null)download('traveller-unreadable-draft-backup.json',recoveryRaw);};
$('#recovery-replace').onclick=()=>{
 if(busy||recoveryRaw===null)return;
 if(!confirm('Replace the unreadable stored draft with the current character? Download its raw backup first if you want to keep it.'))return;
 recoveryRaw=null;persist();updateRecovery();notify(storageWarning||'Stored draft replaced after confirmation.',!!storageWarning);
};
$('#new').onclick=async()=>{
 if(busy)return;
 if(!confirm('Start a new character? Save your current character and log first. The current browser draft will be replaced.'+(recoveryRaw!==null?' Download the unreadable draft backup before replacing it.':'')))return;
 const token=++operationGeneration;setBusy(true);
 try{
  const result=await call({operation:'create',seed:crypto.randomUUID()});if(token!==operationGeneration)return;if(!result.ok)throw new Error(result.error.message);
  session=result.session;projection=result;selectedCareer='';effects=[];recoveryRaw=null;persist();updateRecovery();render();$('#step-title')?.focus();notify(storageWarning||'New character started.',!!storageWarning);
 }catch(error){if(token===operationGeneration)notify('Could not start a new character: '+error.message,true);}
 finally{if(token===operationGeneration)setBusy(false);}
};
$('#import').onchange=async event=>{
 const file=event.target.files[0];if(!file)return;
 if(busy){event.target.value='';notify('Wait for the current action to finish before loading another character.',true);return;}
 const token=++operationGeneration;setBusy(true);
 try{
  if(file.size>2000000)throw new Error('This save is too large.');
  const result=await call({operation:'import',raw:await file.text()});if(token!==operationGeneration)return;if(!result.ok)throw new Error(result.error.message);
  if(projection.revision&&!confirm('Load this character in place of the current browser draft? Save your current character first.'))return;
  session=result.session;projection=result;selectedCareer='';effects=[];persist();render();$('#step-title')?.focus();notify(storageWarning||'Character loaded. Its complete action log was replayed and verified.',!!storageWarning);
 }catch(error){if(token===operationGeneration)notify('Could not load: '+error.message+' Your current character was kept.',true);}
 finally{event.target.value='';if(token===operationGeneration)setBusy(false);}
};
async function start(){
 setBusy(true);
 try{
  catalog=await call({operation:'catalog'});if(!catalog.ok)throw new Error(catalog.error.message);
  let saved;try{saved=localStorage.getItem(key);}catch{storageWarning='Browser storage unavailable. Save character & log regularly.';}
  if(saved){try{projection=await call({operation:'import',raw:saved});if(!projection.ok)throw new Error(projection.error.message);session=projection.session;}
   catch(error){recoveryRaw=saved;storageWarning='The stored draft could not be opened. Its raw file is preserved. Use the recovery controls to download it before choosing whether to replace it.';}}
  if(!projection?.ok){const result=await call({operation:'create',seed:crypto.randomUUID()});if(!result.ok)throw new Error(result.error.message);session=result.session;projection=result;}
  updateRecovery();render();if(storageWarning)notify(storageWarning,true);
 }catch(error){notify('Unable to start the rules engine: '+error.message,true);}
 finally{setBusy(false);}
}
start();
