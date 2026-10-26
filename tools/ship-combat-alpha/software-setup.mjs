import {SOFTWARE,sourcePrograms} from './software-catalogue.mjs';
import {escapeHTML as esc} from './ui-format.mjs';
const drafts=new WeakMap();
export const readSoftwareSetupChanges=input=>drafts.get(input)??null;
// Keep the original string byte-for-byte until the user changes a row.
export function mountSoftwareSetup(input,systems){
 const container=document.createElement('div');container.className='software-setup';
 const rawLabel=input.closest('label'),help=document.createElement('details');help.innerHTML='<summary>Software notes and original text</summary><p>Installed package records only. Dropdown rows edit installed packages. Legacy text edits retain independent operating packages. Running allocations remain separate. Unknown/source-specific entries are retained. New choices use the cited catalogue requirements; no combat effect is automated.</p>';rawLabel.before(container,help);help.append(rawLabel);
 const choices=SOFTWARE.flatMap(p=>p.variants.map(v=>({value:p.name+' / '+v.rating,label:p.name+' / '+v.rating+' · '+v.bandwidth+' BW · TL '+v.tl,source:p.source,note:p.note})));
 const key=value=>value.toLowerCase().replace(/\s*\/\s*/g,'/');
 const match=value=>choices.find(c=>key(c.value)===key(value)||key(c.value.replace(' / 0',''))===key(value));
 const render=(useInstalled=true)=>{container.replaceChildren();let tokens=input.value.split(/[;,]/).map(x=>x.trim()).filter(Boolean);if(useInstalled&&systems?.software?.installed){const seen=new Set();tokens=tokens.map(token=>{const id=sourcePrograms(token).installed[0]?.id,actual=systems.software.installed.find(p=>p.id===id);if(!actual)return token;seen.add(id);return SOFTWARE.find(p=>p.id===id).name+' / '+actual.installed;});for(const actual of systems.software.installed)if(!seen.has(actual.id))tokens.push(SOFTWARE.find(p=>p.id===actual.id).name+' / '+actual.installed);}for(const token of tokens)add(token);const button=document.createElement('button');button.type='button';button.dataset.addSoftware='';button.textContent='Add Software';button.addEventListener('click',()=>{const row=add('');button.before(row);row.querySelector('select').focus();});container.append(button);};
 const sync=()=>{drafts.set(input,{explicit:true});input.value=[...container.querySelectorAll('select')].map(x=>x.value).filter(Boolean).join('; ');input.dispatchEvent(new Event('change',{bubbles:true}));};
 function add(token){const row=document.createElement('div');row.className='software-setup-row';const known=match(token);const rows=[{value:'',label:'Choose software…'},...choices];if(token&&!rows.some(x=>x.value===token))rows.push({value:token,label:known?known.label:token+' · retained / unverified'});row.innerHTML='<label>Installed software<select aria-label="Installed software">'+rows.map(x=>`<option value="${esc(x.value)}" ${x.value===token?'selected':''}>${esc(x.label)}</option>`).join('')+'</select></label><button type="button" aria-label="Remove software row">Remove</button><small></small>';const note=()=>{const c=match(row.querySelector('select').value);row.querySelector('small').textContent=c?`${c.source.book}, p. ${c.source.page}.`:token?'Retained source or manual description; requirements may be unknown.':'';};note();row.querySelector('select').addEventListener('change',()=>{note();sync();});row.querySelector('button').addEventListener('click',()=>{row.remove();sync();});container.append(row);return row;}
 const notes=document.createElement('p');notes.textContent=SOFTWARE.filter(p=>p.note).map(p=>p.name+': '+p.note).join(' ');help.append(notes);input.addEventListener('input',()=>{drafts.delete(input);render(false);});render();
 if(systems?.software?.installed?.length){const note=document.createElement('p');note.className='help';note.textContent='Existing operating software and manual processing overrides are preserved. Use Power & software to change running allocations.';help.append(note);}
}
export function validateSoftwareSetup(value,original){
 if(value===original)return;const ids=(value??'').split(/[;,]/).flatMap(token=>sourcePrograms(token).installed.map(p=>p.id));if(new Set(ids).size!==ids.length)throw Error('Choose each software package once; select its installed rating in that row.');
}
export function softwareSetupSystems(ship,nextDesign,edits){
 if(!edits?.explicit)return ship.systems;
 const overrides=ship.designOverrides?.record;
 const previous=overrides&&Object.hasOwn(overrides,'software')?overrides.software:ship.template?.record?.software;

 validateSoftwareSetup(nextDesign.record.software,previous);
 const parsed=sourcePrograms(nextDesign.record.software).installed;
 const installed=parsed.map(p=>{const old=ship.systems.software.installed.find(x=>x.id===p.id);return {...p,running:old?.running!=null&&old.running<=p.installed?old.running:null,origin:'manual'};});

 return {...ship.systems,software:{...ship.systems.software,installed}};
}
