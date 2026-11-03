import {initiativeProfile,initiativeInputsChanged} from './initiative.mjs';
import {openingTactics,effectiveTactics,openingInitiativeEntry,openingReady} from './opening.mjs';
import {rollPilotDice} from './pilot-check.mjs';
import {escapeHTML as esc} from './ui-format.mjs';
const PHASES=['Opening','Manoeuvre','Attack','Crew Actions','End of Round'];
const phaseOf=state=>state.workflow?.phase==='attacks'?'Attack':state.workflow?.phase==='crew'?'Crew Actions':state.workflow||state.acceleration?'Manoeuvre':'Opening';
const number=(value,label,min,max)=>{if(value===''||!Number.isSafeInteger(Number(value))||Number(value)<min||Number(value)>max)throw Error(label+' requires a whole number from '+min+' to '+max+'.');return Number(value);};
// UI drafts never contain unsaved dice: each explicit roll is committed once.
export function createOpeningMfd({phaseBar,root,mfd,getState,getSelected,onSelect,dispatch,isLocked,onRefresh}){
 const drafts=new Map();let chosen='Opening',page='tactics',lastPhase=null,lastRevision=-1,error='',busy=false;
 const ship=()=>getState().ships.find(s=>s.id===getSelected());
 function draftFor(s){if(!drafts.has(s.id)){const p=initiativeProfile(s),t=openingTactics(s),r=s.flight.initiativeRecord;drafts.set(s.id,{revision:getState().revision,dirty:false,tacticsFiat:t?.kind==='fiat'||t?.gmEffect!=null,initiativeFiat:s.flight.initiative!=null&&(!r||s.flight.initiative!==r.result.total),modifier:t?.modifier??p.tactics??'',effect:t&&t.kind!=='legacy'?effectiveTactics(t):'',pilot:r?.result.pilot??p.pilot??'',total:s.flight.initiative??'',tie:s.flight.tie});}return drafts.get(s.id);}
 const input=(label,field,value,min,max,disabled=false)=>`<label>${label}<input data-opening-field="${field}" type="number" step="1" min="${min}" max="${max}" value="${esc(String(value))}" ${disabled?'disabled':''}></label>`;
 const savedTactics=t=>!t?'No Tactics result saved.':t.kind==='legacy'?'Manual / legacy initiative includes an unrecorded Tactics contribution. No Effect or dice are inferred.':`${t.dice?t.dice.join(' + ')+' '+(t.modifier>=0?'+ ':'− ')+Math.abs(t.modifier)+' − 8 = ':'GM Fiat Effect '}${t.effect}${t.gmEffect!=null?' · GM override Effect '+t.gmEffect:''}`;
 function render(){
  const focused=document.activeElement;let focusKey=null;
  if(phaseBar.contains(focused)&&focused?.dataset.mfdPhase)focusKey=`[data-mfd-phase="${focused.dataset.mfdPhase}"]`;
  else if(root.contains(focused))focusKey=focused?.dataset.openingPage?`[data-opening-page="${focused.dataset.openingPage}"]`:'[data-opening-next]';
  else if(mfd.contains(focused)&&focused?.closest('[data-opening-form], [data-opening-confirm], [data-opening-refresh], [data-opening-discard]'))focusKey=focused.dataset.openingField?`[data-opening-field="${focused.dataset.openingField}"]`:`[data-opening-page="${page==='initiative'?'initiative':'tactics'}"]`;
  try{
  const state=getState(),current=phaseOf(state);for(const id of drafts.keys())if(!state.ships.some(s=>s.id===id))drafts.delete(id);if(lastPhase===null)chosen=current==='Opening'?'Opening':null;if(state.revision<lastRevision)drafts.clear();lastRevision=state.revision;
  if(lastPhase!==null&&lastPhase!==current){chosen=current==='Opening'?'Opening':null;page='tactics';error='';}lastPhase=current;
  phaseBar.innerHTML=PHASES.map(p=>`<button type="button" data-mfd-phase="${p}" aria-pressed="${chosen===p}" ${p===current?'aria-current="step"':''}>${p}</button>`).join('');
  root.hidden=chosen!=='Opening';root.innerHTML='';
  if(chosen===null)return;
  const screen=mfd.querySelector('.mfd-screen');if(!screen)return;screen.classList.add('opening-screen');mfd.querySelectorAll('[data-mfd]').forEach(b=>b.setAttribute('aria-pressed','false'));
  if(chosen!=='Opening'){screen.innerHTML=`<h2>${esc(chosen)} · phase overview</h2><p>Read only · current phase: ${esc(current)}.</p><p>Use the existing command bar and crew-station controls for ${esc(chosen)}. Selecting this phase does not advance combat.</p>`;return;}
  const s=ship(),ready=openingReady(state),locked=isLocked()||!!state.workflow||!!state.acceleration;
  root.innerHTML=`<p class="opening-selected">Opening · <strong>${esc(s?.name??'No ship selected')}</strong> · ${state.ships.filter(s=>s.flight.initiative!=null).length}/${state.ships.length} initiative totals saved</p><div class="opening-action-row"><button type="button" data-opening-page="tactics" aria-pressed="${page==='tactics'}">Tactics</button><button type="button" data-opening-page="initiative" aria-pressed="${page==='initiative'}">Initiative</button><button type="button" data-opening-next ${!s||locked?'disabled':''}>${ready?'Next Phase':'Next Ship'}</button></div>`;
  if(!s){screen.innerHTML='<h2>Opening</h2><p>Add or select a ship. Setup remains available in Details or Quick Setup.</p>';return;}
  const d=draftFor(s),t=openingTactics(s),record=s.flight.initiativeRecord,stale=d.revision!==state.revision,disabled=locked||stale;
  if(page==='confirm'){
   const pending=[...drafts.values()].some(d=>d.dirty);
   screen.innerHTML=`<h2>Opening · GM confirmation</h2><p>Review the saved initiative order. Confirming begins Manoeuvre; it does not roll or move ships.</p><ol>${[...state.ships].sort((a,b)=>a.flight.initiative-b.flight.initiative||a.flight.tie-b.flight.tie||a.id.localeCompare(b.id)).map(s=>`<li>${esc(s.name)} · ${s.flight.initiative??'Not recorded'} · tie ${s.flight.tie}</li>`).join('')}</ol>${state.ships.some(initiativeInputsChanged)?'<p role="alert">Crew or thrust changed after a saved roll. Review the original outcomes before confirming; no total was rerolled.</p>':''}${pending?'<p role="alert">Unsaved Opening fields remain. Save or discard those edits before confirming.</p><button type="button" data-opening-discard>Discard unsaved Opening fields</button>':''}<button type="button" data-opening-confirm ${!ready||locked||pending?'disabled':''}>GM · Confirm Initiative</button>${error?'<p role="alert">'+esc(error)+'</p>':''}`;return;
  }
  const warning=stale?'<p role="alert">Encounter changed. Saved outcomes are preserved. Refresh these unsaved fields before applying a change.</p><button type="button" data-opening-refresh>Refresh inputs</button>':'';
  const header=`<h2>Opening · ${page==='tactics'?'Tactics':'Initiative'}</h2><h3>${esc(s.name)}</h3>${locked?'<p>Opening records are read only while combat, declarations or another editor is active.</p>':''}${warning}`;
  if(page==='tactics'){
   screen.innerHTML=header+`<p data-opening-saved-tactics>${esc(savedTactics(t))}</p>${t?.profile&&JSON.stringify(t.profile)!==JSON.stringify(initiativeProfile(s))?'<p role="alert">Inputs changed since saved Tactics. The original Effect is retained.</p>':''}<form data-opening-form="tactics"><label class="opening-fiat"><input type="checkbox" data-opening-field="tacticsFiat" ${d.tacticsFiat?'checked':''} ${disabled||s.flight.initiative!=null?'disabled':''}> GM Fiat · enter Effect</label><div class="opening-fields">${d.tacticsFiat?input('Tactics Effect','effect',d.effect,-100,100,disabled||s.flight.initiative!=null):input('Naval Tactics modifier','modifier',d.modifier,-30,40,disabled||!!t)}</div><p>8+ naval Tactics · raw Effect contributes to Initiative, including negative results. A Captain assignment alone does not establish naval skill.</p><button type="submit" ${disabled||s.flight.initiative!=null||!d.tacticsFiat&&!!t?'disabled':''}>${d.tacticsFiat?'Save GM Fiat Effect':'Roll & save Tactics'}</button></form>`;
  }else{
   screen.innerHTML=header+`<p>Saved Tactics: ${esc(savedTactics(t))}</p><p data-opening-saved-initiative>${s.flight.initiative==null?'No Initiative saved.':'Saved Initiative: '+s.flight.initiative+(record&&record.result.total!==s.flight.initiative?' · GM override':'')}</p>${record?`<p>Original roll: ${record.result.baseDice.join(' + ')} + Pilot ${record.result.pilot} + Thrust ${record.result.thrust} + Tactics Effect ${record.result.tacticsEffect} = ${record.result.total}</p>`:s.flight.initiative!=null?'<p>Manual / legacy total; original dice and inputs were not recorded.</p>':''}<form data-opening-form="initiative"><label class="opening-fiat"><input type="checkbox" data-opening-field="initiativeFiat" ${d.initiativeFiat?'checked':''} ${disabled?'disabled':''}> GM Fiat · enter Initiative total</label><div class="opening-fields">${d.initiativeFiat?input('Initiative total','total',d.total,-1000000,1000000,disabled):input('Pilot skill (no characteristic modifier)','pilot',d.pilot,0,10,disabled||s.flight.initiative!=null)}${input('Tie order · lower first','tie',d.tie,-1000000,1000000,disabled)}</div><p>2D + Pilot skill + current Thrust + saved Tactics Effect. Initiative is recorded once for the battle, not rerolled each round.</p>${!t?'<p>Save a Tactics roll or GM Fiat Effect first.</p>':''}<button type="submit" ${disabled||!t||!d.initiativeFiat&&s.flight.initiative!=null?'disabled':''}>${d.initiativeFiat?'Save GM Fiat Initiative':'Roll & save Initiative'}</button></form>`;
  }
  if(error)screen.innerHTML+='<p role="alert">'+esc(error)+'</p>';
  }finally{if(focusKey&&!focused?.isConnected){const next=phaseBar.querySelector(focusKey)??root.querySelector(focusKey)??mfd.querySelector(focusKey);if(next&&!next.disabled&&!(root.hidden&&root.contains(next)))next.focus({preventScroll:true});else phaseBar.querySelector('[aria-current]')?.focus({preventScroll:true});}}
 }
 function capture(e){const key=e.target.dataset.openingField,s=ship();if(!key||!s)return;const d=draftFor(s);d[key]=e.target.type==='checkbox'?e.target.checked:e.target.value;d.dirty=true;}
 mfd.addEventListener('input',capture);mfd.addEventListener('change',e=>{capture(e);if(e.target.type==='checkbox'&&e.target.dataset.openingField){render();mfd.querySelector(`[data-opening-field="${e.target.dataset.openingField}"]`)?.focus({preventScroll:true});}});
 phaseBar.addEventListener('click',e=>{const p=e.target.closest('[data-mfd-phase]')?.dataset.mfdPhase;if(!p)return;chosen=p;error='';onRefresh();});
 root.addEventListener('click',e=>{
  if(e.detail>1)return;const p=e.target.closest('[data-opening-page]')?.dataset.openingPage;if(p){page=p;error='';onRefresh();return;}
  if(!e.target.closest('[data-opening-next]')||isLocked()||getState().workflow||getState().acceleration)return;
  if(openingReady(getState())){page='confirm';error='';onRefresh();return;}
  const ships=getState().ships,index=ships.findIndex(s=>s.id===getSelected());if(ships.length){error='';onSelect(ships[(index+1)%ships.length].id);}
 });
 mfd.addEventListener('click',e=>{
  if(e.target.closest('[data-opening-refresh]')){if(ship())drafts.delete(ship().id);error='';onRefresh();}
  if(e.target.closest('[data-opening-discard]')){drafts.clear();error='';onRefresh();}
  if(e.target.closest('[data-opening-confirm]')){if(busy||isLocked()||getState().workflow||getState().acceleration||!openingReady(getState())||[...drafts.values()].some(d=>d.dirty))return;busy=true;try{if(dispatch({type:'start-battle',expectedRevision:getState().revision},'Initiative confirmed; Opening records retained.')){chosen=null;drafts.clear();}}finally{busy=false;onRefresh();}}
 });
 mfd.addEventListener('submit',e=>{
  const form=e.target;if(!form.dataset.openingForm)return;e.preventDefault();if(busy||isLocked())return;
  const state=getState(),s=ship();if(!s)return;const d=draftFor(s);if(state.revision>=1000000){error='Prototype revision limit reached. Save this encounter before resetting.';onRefresh();return;}if(state.workflow||state.acceleration||d.revision!==state.revision){error='Encounter changed or Opening is locked. Refresh and review saved records.';onRefresh();return;}
  busy=true;try{
   let command;
   if(form.dataset.openingForm==='tactics'){
    if(s.flight.initiative!=null)throw Error('Initiative already saved; Tactics is preserved.');
    if(d.tacticsFiat)command={type:'record-opening-tactics',shipId:s.id,handling:'fiat',effect:number(d.effect,'Tactics Effect',-100,100)};
    else{if(openingTactics(s))throw Error('Tactics already saved; it cannot be rolled again.');const modifier=number(d.modifier,'Naval Tactics modifier',-30,40);command={type:'record-opening-tactics',shipId:s.id,handling:'roll',modifier,dice:rollPilotDice()};}
   }else{
    if(!openingTactics(s))throw Error('Save a Tactics roll or GM Fiat Effect first.');const tie=number(d.tie,'Tie order',-1000000,1000000);let entry;
    if(d.initiativeFiat)entry=openingInitiativeEntry(s,{handling:'fiat',total:number(d.total,'Initiative total',-1000000,1000000),tie});
    else{if(s.flight.initiative!=null)throw Error('Initiative already saved; use GM Fiat instead of rerolling.');const pilot=number(d.pilot,'Pilot skill',0,10);entry=openingInitiativeEntry(s,{handling:'roll',pilot,baseDice:rollPilotDice(),tie});}
    command={type:'record-initiatives',entries:state.ships.map(x=>x.id===s.id?entry:{shipId:x.id,initiative:x.flight.initiative,tie:x.flight.tie,initiativeRecord:x.flight.initiativeRecord??null})};
   }
   if(dispatch({...command,expectedRevision:d.revision},'Opening result saved; navigation never rolls.')){drafts.delete(s.id);error='';}
  }catch(err){error=err.message;}finally{busy=false;onRefresh();}
 });
 for(const owner of [root,mfd,phaseBar])owner.addEventListener('keydown',e=>{if(e.repeat&&['Enter',' '].includes(e.key))e.preventDefault();});
 return {render,legacy(){chosen=null;error='';},clear(){drafts.clear();chosen='Opening';page='tactics';lastPhase=null;lastRevision=-1;error='';}};
}
