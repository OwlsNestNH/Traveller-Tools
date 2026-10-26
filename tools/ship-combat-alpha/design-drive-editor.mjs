import {DRIVE_TECH_PROFILES,DRIVE_TECH_OPTIONS,initialManoeuvre,normalizeManoeuvre,designDrivePower} from './design-drive-power.mjs';
import {editedRequirement} from './catalogue-provenance.mjs';
import {escapeHTML as esc,shown} from './ui-format.mjs';
const drafts=new WeakMap();
export const readDriveSetup=input=>drafts.get(input)?.read();
export function mountDriveSetup(root,prefix,template,cell,powerCell){
 const thrust=root.querySelector('#'+prefix+'-design-thrust');
 let config=initialManoeuvre(template),touched=false;
 const host=document.createElement('details');host.className='drive-design-controls';
 const options=(rows,value)=>rows.map(([v,label])=>`<option value="${esc(v)}" ${v===value?'selected':''}>${esc(label)}</option>`).join('');
 host.innerHTML=`<summary>Design Power &amp; tech</summary><div class="setup-field-options">
 <label>Power basis<select data-drive-mode>${options([['recorded','Keep recorded requirement'],['auto','Calculate from design'],['manual','Manual design override']],config.mode)}</select></label>
 <label>Drive installation<select data-drive-kind>${options([['unknown','Unknown / unverified'],['mdrive','M-drive · rated ship Thrust'],['combined','M-drive with reaction assistance'],['reaction','Reaction only · no Power'],['none','No drive installed'],['concealed','Concealed M-drive · verify Power']],config.kind)}</select></label>
 <label data-drive-contribution-label>M-drive Thrust only<input data-drive-contribution type="number" min="0" max="10000" step="1" placeholder="Unknown" value="${config.mdriveThrust??''}"></label>
 <label data-drive-manual-label>Manual design Power<input data-drive-manual type="number" min="0" max="1000000" step="any" placeholder="Unknown" value="${config.manualPower??''}"></label>
 <label>Component tech profile<select data-drive-profile>${options(Object.entries(DRIVE_TECH_PROFILES).map(([id,p])=>[id,p.label]),config.tech.profile)}</select></label>
 <div data-drive-tech-rows></div><button type="button" data-drive-add-tech>+ Tech option</button>
 <label class="check"><input type="checkbox" data-drive-repeat ${config.tech.repeatApproved?'checked':''}> Referee approved repeated options</label>
 <small data-drive-budget></small><p class="help">Design Power uses rated M-drive Thrust, not a turn's expenditure. Reaction assistance is excluded. Manual design and operating overrides remain separate. Size and range restrictions are recorded here; ship cost, tonnage and movement are not changed automatically.</p>
 <small>High Guard Update 2022, pp. 16–17, 70–71. Existing source requirements remain preserved. Choose calculation explicitly before replacing a recorded requirement.</small></div>`;
 cell.append(host);powerCell.innerHTML='<strong data-drive-value></strong><small data-drive-basis></small><small data-drive-reason role="status"></small>';
 const get=s=>root.querySelector('#'+prefix+'-'+s),field=s=>host.querySelector('[data-drive-'+s+']');
 function renderRows(){const box=field('tech-rows');box.replaceChildren();config.tech.options.forEach((id,index)=>{const row=document.createElement('div');row.className='drive-tech-row';row.innerHTML=`<label>Drive tech option<select data-drive-option="${index}">${options([['','Choose an option…'],...DRIVE_TECH_OPTIONS.filter(o=>!DRIVE_TECH_PROFILES[config.tech.profile].side||o.side===DRIVE_TECH_PROFILES[config.tech.profile].side||o.id===id).map(o=>[o.id,o.name+' · '+o.points+' '+o.side+(o.points===1?'':'s')])],id)}</select></label><button type="button" data-drive-remove="${index}" aria-label="Remove drive tech option ${index+1}">Remove</button><small>${esc(DRIVE_TECH_OPTIONS.find(o=>o.id===id)?.note??'')}</small>`;box.append(row);});}
 function draftDesign(){const requirements=get('requirements'),rows=requirements?.dataset.known==='true'?[...requirements.querySelectorAll('[data-requirement-row]')].map(row=>{const [name,power]=row.querySelectorAll('input'),i=row.dataset.originIndex;return editedRequirement(i===''?null:template?.record?.requirements?.[Number(i)],name.value,power.value===''?null:Number(power.value));}):null;return {...template,tons:get('tons').value===''?null:Number(get('tons').value),thrust:thrust.value===''?null:Number(thrust.value),record:{...template?.record,tl:get('tl').value===''?null:Number(get('tl').value),requirements:rows,manoeuvre:config}};}
 function refresh(){
  field('contribution-label').hidden=config.kind!=='combined';field('contribution').disabled=config.kind!=='combined';field('manual-label').hidden=config.mode!=='manual';field('manual').disabled=config.mode!=='manual';
  const profile=DRIVE_TECH_PROFILES[config.tech.profile],used=config.tech.options.reduce((n,id)=>n+(DRIVE_TECH_OPTIONS.find(o=>o.id===id)?.points??0),0);field('add-tech').disabled=!['mdrive','combined','concealed'].includes(config.kind)||config.tech.options.length>=3||profile.points!=null&&used>=profile.points;field('budget').textContent=profile.points==null?'Tech options remain unverified.':`${used} / ${profile.points} ${profile.side??'tech'} points selected. Advantages and disadvantages cannot be mixed.`;
  let result;try{result=designDrivePower(draftDesign());}catch(e){result={value:null,basis:'Needs review',reason:e.message};}
  powerCell.querySelector('[data-drive-value]').textContent=shown(result.value);powerCell.querySelector('[data-drive-basis]').textContent=result.basis;powerCell.querySelector('[data-drive-reason]').textContent=[result.reason,...result.warnings??[]].filter(Boolean).join(' ');
 }
 function collect(){config={...config,mode:field('mode').value,kind:field('kind').value,manualPower:field('manual').value===''?null:Number(field('manual').value),mdriveThrust:field('contribution').value===''?null:Number(field('contribution').value),tech:{profile:field('profile').value,options:[...host.querySelectorAll('[data-drive-option]')].map(e=>e.value),repeatApproved:field('repeat').checked}};}
 const notify=()=>host.dispatchEvent(new Event('input',{bubbles:true}));
 host.addEventListener('input',e=>{if(e.target===host)return;collect();touched=true;if(e.target.matches('[data-drive-profile]'))renderRows();refresh();});
 host.addEventListener('change',e=>{if(e.target.matches('[data-drive-option]')){renderRows();notify();}});
 host.addEventListener('click',e=>{if(e.target.closest('[data-drive-add-tech]')){config.tech.options.push('');touched=true;renderRows();refresh();[...host.querySelectorAll('[data-drive-option]')].at(-1)?.focus();notify();}const remove=e.target.closest('[data-drive-remove]');if(remove){config.tech.options.splice(Number(remove.dataset.driveRemove),1);touched=true;renderRows();refresh();notify();}});
 root.addEventListener('input',refresh);root.addEventListener('change',refresh);
 drafts.set(thrust,{read:()=>touched?normalizeManoeuvre(config):template?.record?.manoeuvre,refresh});renderRows();refresh();
 return refresh;
}
