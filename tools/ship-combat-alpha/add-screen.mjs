import {weaponPools} from './weapon-fit.mjs';
import {isEnergyWeapon,recordedWeaponPower} from './weapon-supply.mjs';
import {unknownButton,openUnknownNumber,editUnknownInput} from './unknown-value.mjs';
import {renderPublishedInventory} from './published-inventory.mjs';
import {SIDES,ICONS,iconFor,fallbackGlyph} from './appearance.mjs';
import {ROLES,RATINGS,normalizeCrew} from './setup.mjs';
import {escapeHTML as esc,sourceLabel,shown} from './ui-format.mjs';
import {LOADOUTS,fitLoadout} from './add-loadout.mjs';
const $=id=>document.getElementById(id);
const cards=(name,rows,current)=>`<div class="add-cards">${rows.map(([value,label,mark])=>`<label class="add-card"><input type="radio" name="${name}" value="${value}" ${value===current?'checked':''}><span class="card-mark" aria-hidden="true">${mark}</span><span>${label}</span></label>`).join('')}</div>`;
export function mountAddScreen({source,readDesign,setWeapons}){
 const form=$('new-form');let choice='keep',sand=false,custom=false,manualAmmo={};
 const section=(title,n)=>{const s=document.createElement('section');s.className='add-section';s.innerHTML=`<h3><span>${n}</span> ${title}</h3>`;return s;};
 const ship=section('Choose your ship',1),crew=section('Crew',2),weapons=section('Weapon loadout',3),main=document.createElement('div'),preview=document.createElement('aside');
 main.className='add-main';preview.className='add-preview';preview.id='add-preview';form.prepend(main,preview);main.append(ship,crew,weapons);
 for(const id of ['preset-search','design-select'])ship.append($(id).closest('label'));
 $('design-select').previousSibling.textContent='Ship preset';ship.append($('preset-results'));
 const identity=document.createElement('div');identity.className='add-identity';identity.append($('instance-name').closest('label'));
 const side=$('add-side').closest('label');side.hidden=true;identity.append(side);
 identity.insertAdjacentHTML('beforeend',`<fieldset class="add-side"><legend>Combat side</legend>${cards('add-side-card',Object.entries(SIDES).map(([k,v])=>[k,k,'●']),'A')}</fieldset>`);ship.append(identity);
 const rating=$('add-crew-rating').closest('label');rating.hidden=true;crew.append(rating);
 crew.insertAdjacentHTML('beforeend',`<fieldset class="add-mode"><legend>Crew mode</legend>${cards('add-mode',[['quick','Trivial · one rating',''],['detailed','Detailed · by role','']],'quick')}</fieldset><div id="add-trivial">${cards('add-rating',Object.entries(RATINGS).map(([k,v])=>[k,k,`+${v}`]),$('add-crew-rating').value)}</div><div id="add-detailed" hidden><p>Record actual skill separately from characteristic DM. Unassigned stations remain unknown.</p>${ROLES.map(r=>`<fieldset><legend>${r}</legend><label class="check"><input type="checkbox" data-add-assigned="${r}"> Record this station</label><div class="editor-grid">${[['name','Name (optional)','text','maxlength="60"'],['skillName','Skill / specialty','text','maxlength="60"'],['skill','Skill level','number','min="0" max="10" step="1"'],['characteristicDM','Characteristic DM','number','min="-5" max="5" step="1"']].map(([k,label,type,attrs])=>`<label>${label}<input data-add-role="${r}" data-field="${k}" type="${type}" ${attrs} value="${k==='skillName'?r:''}" ${k!=='name'?'required':''} disabled></label>`).join('')}</div></fieldset>`).join('')}</div>`);
 weapons.insertAdjacentHTML('beforeend',`<button type="button" id="add-customize">Customize →</button>${cards('add-loadout',Object.entries(LOADOUTS).map(([k,v],i)=>[k,v,['↶','⊘','━','☷','↗'][i]]),'keep')}<label class="check add-defense"><input type="checkbox" id="add-sand"> Add sandcaster defense <small>Optional · occupies turret capacity</small></label><p id="add-fit-help" class="help"></p>`);
 const details=$('new-stat-details');weapons.append(details);details.hidden=true;
 // Coordinates stay available as the keyboard placement fallback.
 const coords=$('add-q').closest('details');main.append(ship,crew,weapons,coords);form.prepend(main,preview);
 $('quick-source').remove();form.querySelectorAll(':scope > .editor-grid,:scope > .actions,:scope > h4').forEach(e=>e.remove());
 form.insertAdjacentHTML('beforeend','<button type="submit" hidden>Place on map</button>');
 function mode(){return form.querySelector('[name="add-mode"]:checked').value;}
 function readCrew(){const result={mode:mode(),ratingVersion:2,rating:$('add-crew-rating').value,details:{}};if(result.mode==='detailed')for(const role of ROLES){const assigned=form.querySelector(`[data-add-assigned="${role}"]`).checked;if(assigned){const d={};for(const el of form.querySelectorAll(`[data-add-role="${role}"]`))d[el.dataset.field]=el.type==='number'?(el.value===''?null:Number(el.value)):el.value;result.details[role]=d;}}return normalizeCrew(result);}
 function design(){const t=readDesign();if(!custom)t.record.weapons=fitLoadout(t,source()?.id,choice,sand);for(const w of t.record.weapons??[])if(Object.hasOwn(manualAmmo,w.id))w.ammunition=manualAmmo[w.id];return t;}
 function refresh(){
  const src=source();let t,problem='';try{t=design();}catch(e){problem=e.message;try{t=readDesign();}catch{t=src;}}
  for(const radio of form.querySelectorAll('[name="add-loadout"]')){try{fitLoadout(readDesign(),src?.id,radio.value,false);radio.disabled=false;}catch{radio.disabled=!['keep','unarmed'].includes(radio.value);}}
  const capacity=src?.id==='drinax-harrier-restored';$('add-sand').disabled=!capacity||choice==='unarmed'||custom;
  $('add-fit-help').textContent=problem||(custom?'Manual fit: review each mount and its capacity below.':capacity?'Verified single ventral turret; particle barbette retained except when Unarmed. Sandcaster replaces the ventral weapon. Missile + pulse needs two separate turrets: use Customize.':'Mount capacities are unverified. Keep existing preserves unknown fit. Use Customize to record weapons and capacity from your source.');
  const icon=iconFor({template:src,appearance:{icon:'auto'}}),art=ICONS[icon],side=$('add-side').value,fit=t?.record?.weapons;
  preview.innerHTML=`<p class="eyebrow">Your ship · draft</p><h3>${esc($('instance-name').value||'Name your ship')}</h3><p>${esc(t?.name??'Custom design')}</p><span class="add-side-badge">SIDE ${esc(side)}</span><svg class="add-art" viewBox="-55 -40 110 80" role="img" aria-label="${esc(art.label)}">${art.file?`<image href="assets/ships/${esc(art.file)}" x="-40" y="-35" width="80" height="70"/>`:fallbackGlyph(icon,SIDES[side].color)}</svg><small>${esc(art.label)}</small><dl class="add-stats">${[['Tons',t?.tons],['Thrust',t?.thrust],['Hull',t?.hull],['Armour',t?.armour]].map(([k,v])=>`<div><dd>${v==null&&['Hull','Armour'].includes(k)?unknownButton(k.toLowerCase(),k==='Hull'?'Maximum hull points':k):esc(shown(v))}</dd><dt>${k}</dt>${src&&v!=null&&v!==src[k.toLowerCase()]&&['Hull','Armour'].includes(k)?'<small class="manual-value">Manual override</small>':''}</div>`).join('')}</dl><dl class="add-summary"><dt>Crew</dt><dd>${mode()==='quick'?esc($('add-crew-rating').value)+' +'+RATINGS[$('add-crew-rating').value]+' · Trivial':'Detailed · actual skill + characteristic DM'}</dd><dt>Loadout</dt><dd>${custom?'Customized':LOADOUTS[choice]}</dd><dt>Defense</dt><dd>${sand?'Sandcaster replaces ventral weapon':'No added sandcaster'}</dd></dl><h4>Resulting fit</h4>${problem?`<p role="alert">${esc(problem)}</p>`:''}<ul class="add-fit">${fit==null?'<li>Unknown / untranscribed equipment retained.</li>':fit.length?fit.map(w=>`<li><strong>${esc(w.name)}</strong><br>${w.count} × ${esc(w.type)}<br><small>${isEnergyWeapon(w)?'Recorded power draw: '+esc(shown(recordedWeaponPower(t,w,src)))+' · Energy weapon; no ammunition entry':`Initial ammunition: ${w.ammunition==null?unknownButton(w.id,w.name+' initial ammunition','data-unknown-ammo'):esc(shown(w.ammunition))}${Object.hasOwn(manualAmmo,w.id)?' · Manual override':''}`}</small></li>`).join(''):'<li>Explicitly unarmed · all weapons removed.</li>'}</ul><p class="help">${esc(sourceLabel(src))}</p>${renderPublishedInventory(src?.record?.published)}${!custom&&(choice!=='keep'||sand)?'<p class="help">Manual instance loadout override. Published template retained. No firing or power allocation is changed.</p>':''}`;
 }
 function customize(){if(!custom){try{setWeapons(design().record.weapons);manualAmmo={};}catch{}}custom=true;sand=false;$('add-sand').checked=false;form.querySelectorAll('[name="add-loadout"]').forEach(r=>r.checked=false);details.hidden=false;details.open=true;details.querySelectorAll('details').forEach(d=>d.open=true);refresh();details.scrollIntoView({block:'nearest'});}
 $('add-customize').addEventListener('click',customize);
 preview.addEventListener('click',e=>{const field=e.target.closest('[data-unknown-value]'),ammo=e.target.closest('[data-unknown-ammo]');if(field){const input=$('new-'+field.dataset.unknownValue);editUnknownInput(input,{fallbackFocus:()=>$('design-select'),label:field.dataset.unknownValue==='hull'?'Maximum hull points':'Armour',reference:'Save to this Add Ship draft only. Published source retained: '+sourceLabel(source()),onSave:refresh});}if(ammo){const id=ammo.dataset.unknownAmmo,src=source(),fit=design().record.weapons,w=fit?.find(w=>w.id===id);if(!w||isEnergyWeapon(w))return;openUnknownNumber({fallbackFocus:()=>$('design-select'),label:w.name+' initial ammunition',step:1,reference:'Manual initial count for this existing mount, not storage capacity. Save to this Add Ship draft only.',onSave:value=>{if(!form.isConnected||source()!==src||!design().record.weapons?.some(x=>x.id===id&&x.type===w.type))throw Error('The ship or mount changed. Cancel and reopen.');const pools=weaponPools(w,design());if(pools.length===1&&pools[0].capacity!=null&&value!=null&&value>pools[0].capacity)throw Error('Initial loaded ammunition exceeds recorded mount capacity.');if(custom){setWeapons(design().record.weapons.map(x=>x.id===id?{...x,ammunition:value}:x));}else manualAmmo[id]=value;refresh();}});}});

 form.addEventListener('weapon-fit-change',()=>{custom=true;refresh();});
 form.addEventListener('input',e=>{
  if(e.target.name==='add-side-card')$('add-side').value=e.target.value;
  if(e.target.name==='add-rating')$('add-crew-rating').value=e.target.value;
  if(e.target.name==='add-loadout'){manualAmmo={};choice=e.target.value;custom=false;if(choice==='unarmed'){sand=false;$('add-sand').checked=false;}}
  if(e.target.id==='add-sand'){manualAmmo={};sand=e.target.checked;}
  const detailed=mode()==='detailed';$('add-trivial').hidden=detailed;$('add-detailed').hidden=!detailed;
  for(const role of ROLES)for(const el of form.querySelectorAll(`[data-add-role="${role}"]`))el.disabled=!detailed||!form.querySelector(`[data-add-assigned="${role}"]`).checked;
  if(e.target.closest('#new-design-fields'))custom=true;
  refresh();
 });
 // The editor calls this after replacing the source and its design controls.
 // A bubbling form change listener would still see the previous source.
 function sourceChanged(){manualAmmo={};choice='keep';sand=false;custom=!source();form.querySelector('[name="add-loadout"][value="keep"]').checked=true;$('add-sand').checked=false;refresh();}
 form.addEventListener('click',e=>{if(e.target.closest('[data-add-weapon],[data-remove-row]')){custom=true;queueMicrotask(refresh);}});
 refresh();return {design,readCrew,refresh,sourceChanged};
}

