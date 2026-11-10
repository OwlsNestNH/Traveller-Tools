export function physicalDiceSetting(state,{setup=false}={}){
 return '<label class="check"><input '+(setup?'name="physicalDice"':'id="gm-physical-dice"')+' type="checkbox"'+(state.config?.physicalDice?' checked':'')+'><span>Allow physical dice score entry<small>Enter dice totals in the six starting score boxes, before species modifiers. Manual entries are flagged on the character sheet and in both logs.</small></span></label>';
}
export function physicalDiceWarning(state){
 return state.character.physicalDiceEntered?'<p class="physical-dice-warning" title="Starting scores were entered manually and not verified by the app. Entries are retained in Simple Log and Full Log.">Manual dice scores</p>':'';
}
export function physicalDiceCards(state,{html,esc}){
 if(!state.config.physicalDice)return html;
 // Preserve the established score cards exactly until a specific card is opened.
 return html.replace(/<(div|button)([^>]*class="stat(?: [^"]*)?"[^>]*)>(<span class="code">([^<]+)<\/span>)/g,(whole,tag,attrs,codeHtml,code)=>{
  if(!state.physicalDiceTargets.some(t=>t.key===code))return whole;
  attrs=attrs.replace(/\s(?:id|data-edit-stat|data-stat-pool|aria-haspopup|aria-controls|aria-label)="[^"]*"/g,'');
  return '<'+tag+attrs+' id="physical-card-'+esc(code)+'" data-physical-card="'+esc(code)+'"'+(tag==='div'?' role="button" tabindex="0"':'')+' aria-label="Enter '+esc(code)+' raw dice score">'+codeHtml;
 });
}
export function mountPhysicalDiceEditor({document,getProjection,canOpen,onSave,getError}){
 let active=null,saving=false,nextCode=null,nextFromPointer=false;
 const cardFor=code=>document.getElementById('physical-card-'+code);
 function close(focus=false){
  if(!active)return;const {card,html,code}=active;active=null;
  if(card.isConnected){card.innerHTML=html;card.classList.remove('physical-stat-card');card.removeAttribute('data-physical-open');if(focus)card.focus({preventScroll:true});}
  return code;
 }
 function open(code){
  if(saving||!canOpen())return;
  if(active?.code===code&&active.card.isConnected)return;
  close();const state=getProjection().state,target=state.physicalDiceTargets?.find(t=>t.key===code),card=cardFor(code);
  if(!card||!target||state.stage!=='statistics'||!state.config.physicalDice)return;
  const score=card.querySelector('strong'),old=state.pool.find(p=>p.key===code);if(!score)return;
  active={card,code,html:card.innerHTML};card.classList.add('physical-stat-card');card.setAttribute('data-physical-open','true');
  const box=document.createElement('div');box.className='physical-inline-entry';
  const label=document.createElement('label');label.htmlFor='physical-stat-'+code;label.textContent='Enter score';
  const input=document.createElement('input');Object.assign(input,{id:'physical-stat-'+code,type:'number',inputMode:'numeric',min:String(target.min),max:String(target.max),step:'1',value:old?.base??''});input.dataset.physicalStat=code;input.setAttribute('aria-label',code+' raw dice total');input.setAttribute('title','Raw dice total before species modifiers ('+target.min+'-'+target.max+')');
  const error=document.createElement('span');error.className='physical-stat-error';error.setAttribute('role','alert');error.hidden=true;
  box.append(label,input,error);score.replaceWith(box);input.focus();input.select();
 }
 async function save(focusCode){
  if(!active||saving||!canOpen())return;const {card,code}=active,input=card.querySelector('input'),error=card.querySelector('.physical-stat-error');
  if(input.value===''||!input.validity.valid){input.setAttribute('aria-invalid','true');error.textContent='Use '+input.min+'-'+input.max+'.';error.hidden=false;return;}
  const old=getProjection().state.pool.find(p=>p.key===code),value=Number(input.value);
  if(old?.base===value&&old.physicalDiceEntered&&old.finalOverride===undefined){close();cardFor(focusCode||code)?.focus({preventScroll:true});return true;}
  saving=true;try{const ok=await onSave({code,value});if(ok){active=null;cardFor(focusCode||code)?.focus({preventScroll:true});}else if(card.isConnected){error.textContent=getError()||'Not saved.';error.hidden=false;}return ok;}finally{saving=false;nextCode=null;}
 }
 document.addEventListener('pointerdown',event=>{nextFromPointer=true;nextCode=event.target.closest('[data-physical-card]')?.dataset.physicalCard??null;},true);
 document.addEventListener('click',event=>{const card=event.target.closest('[data-physical-card]');if(card&&!event.target.closest('.physical-inline-entry')){event.preventDefault();open(card.dataset.physicalCard);}});
 document.addEventListener('focusout',event=>{if(event.target.matches('[data-physical-stat]')){const target=nextFromPointer?nextCode:null,code=active?.code;save(nextCode).then(ok=>{if(ok&&target&&target!==code)open(target);});}});
 document.addEventListener('keydown',event=>{
  const input=event.target.closest('[data-physical-stat]');
  if(input){
   if(event.key==='Escape'){event.preventDefault();close(true);}
   if(event.key==='Enter'){event.preventDefault();save(active?.code);}
   if(event.key==='Tab'){nextFromPointer=false;const cards=[...document.querySelectorAll('[data-physical-card]')],i=cards.indexOf(active?.card);nextCode=cards[i+(event.shiftKey?-1:1)]?.dataset.physicalCard??null;event.preventDefault();save(nextCode);}
  }else{const card=event.target.closest('[data-physical-card]');if(card&&['Enter',' '].includes(event.key)){event.preventDefault();open(card.dataset.physicalCard);}}
 });
}
