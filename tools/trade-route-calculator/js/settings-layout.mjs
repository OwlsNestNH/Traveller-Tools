import {ruleInfo} from './rule-references.mjs?v=time-completion-20261010-48';
// Presentation only: reuse the existing settings controls, names, values and
// validation attributes. The application keeps the same save and Undo path.
const fields={
 mortgageOriginal:['Original mortgage amount · Cr'],mortgagePayment:['Fixed payment · Cr','', 'Every 4 weeks (28 days)'],mortgageRemaining:['Payments remaining'],mortgagePaid:['Total paid so far · Cr'],mortgageDueDate:['First / next unpaid due date'],maintenancePayment:['Maintenance · Cr','', 'Every 4 weeks (28 days)'],maintenanceDueDate:['First / next unpaid due date'],
 name:['Campaign'],ship:['Ship name'],capacity:['Cargo capacity','tons'],jump:['Jump rating'],scoops:['Fuel scoops fitted'],armed:['Ship is armed','','Mail modifier'],
 shipTons:['Ship displacement','tons'],fuelCapacity:['Base fuel tank capacity','tons'],bladderTons:['Fuel bladder capacity','tons'],fuelAboard:['Fuel aboard','tons'],
 broker:['Broker skill'],streetwise:['Streetwise skill'],admin:['Admin skill'],characteristic:['Default EDU / SOC DM'],rank:['Highest Naval / Scout rank'],soc:['Highest SOC DM'],
 mode:['Profit mode'],custom:['Custom profit','%','Only used in Custom mode'],reducedProfitLimitsEnabled:['Enable reduced-profit price limits'],minPurchasePercent:['Minimum buy','%','Percentage of base retail'],maxSalePercent:['Maximum sell','%','Percentage of base retail'],maxBaseRetailEnabled:['Cap commodity base retail price'],maxBaseRetail:['Maximum base retail','Cr / ton'],useRawIllegalPrices:['Use original RAW base prices for illegal goods'],
 'rooms-low':['Low service · cabins'],'roomService-low':['Low cabin running-cost rate'],'roomCustom-low':['Custom low cabin cost','Cr / month','Per cabin; only in Custom mode'],
 'rooms-middle':['Middle service · cabins'],'roomService-middle':['Middle cabin running-cost rate'],'roomCustom-middle':['Custom middle cabin cost','Cr / month','Per cabin; only in Custom mode'],
 'rooms-high':['High service · cabins'],'roomService-high':['High cabin running-cost rate'],'roomCustom-high':['Custom high cabin cost','Cr / month','Per cabin; only in Custom mode'],
 'people-middle':['Awake people — Middle?'],'people-high':['Awake people — High?'],occupiedLowBerths:['Occupied low berths','','Frozen occupants only; exclude from awake people'],luggageOverride:['Override total luggage tons'],luggageTons:['Total luggage','tons','Automatic unless overridden'],
 supportCapacity:['Standard refill target','days'],supportRemaining:['Recorded endurance','days'],supportUnits:['Set actual LSS aboard','LSS','Optional inventory correction; overrides entered days'],tax:['Enable optional Merchant Prince taxes'],insurance:['Enable optional Merchant Prince cargo insurance'],creditStep:['Credit rounding for new entries']
};
export const settingsGroups=[
 {id:'campaign',title:'Campaign & ship',description:'Identity, capacity and fitted equipment',names:['name','ship','capacity','jump','scoops','armed']},
 {id:'fuel',title:'Ship size & fuel',description:'Total configured fuel capacity; no separate tank tracking',names:['shipTons','fuelCapacity','bladderTons','fuelAboard']},
 {id:'mortgage',title:'Mortgage',description:'Original amount, fixed installments and payments made',advanced:true,names:['mortgageOriginal','mortgagePayment','mortgageRemaining','mortgagePaid','mortgageDueDate']},
 {id:'maintenance',title:'Monthly maintenance',description:'A separate four-week payment schedule',advanced:true,names:['maintenancePayment','maintenanceDueDate']},
 {id:'trader',title:'Trader & mail modifiers',description:'Whole-number skills and DMs',advanced:true,names:['broker','streetwise','admin','characteristic','rank','soc']},
 {id:'pricing',title:'Trade rules & pricing',description:'Optional limits and profit settings for new transactions',advanced:true,names:['mode','custom','reducedProfitLimitsEnabled','minPurchasePercent','maxSalePercent','maxBaseRetailEnabled','maxBaseRetail','useRawIllegalPrices']},
 {id:'cabins',title:'Cabins & running costs',description:'All installed cabins, including crew and empty cabins',names:['rooms-low','roomService-low','roomCustom-low','rooms-middle','roomService-middle','roomCustom-middle','rooms-high','roomService-high','roomCustom-high']},
 {id:'people',title:'People & luggage',description:'Awake people include crew; frozen occupants are separate',names:['people-middle','people-high','occupiedLowBerths','luggageOverride','luggageTons']},
 {id:'support',title:'Life support supplies',description:'Supplies actually aboard',names:['supportCapacity','supportRemaining','supportUnits']},
 {id:'optional',title:'Optional taxes & insurance',description:'Merchant Prince campaign rules',advanced:true,names:['tax','insurance']},
 {id:'rounding',title:'Credit rounding',description:'Rounding for new entries',advanced:true,names:['creditStep']}
];
const node=(tag,className,text)=>{const el=document.createElement(tag);if(className)el.className=className;if(text)el.textContent=text;return el;};
function settingRow(input){
 const [caption,unit,hint]=fields[input.name],row=node('div','setting-row'),label=node('label','setting-label',caption),control=node('div','setting-control');
 input.id='setting-'+input.name;label.htmlFor=input.id;
 if(hint)label.append(node('small','',hint));
 if(input.type==='checkbox'){
  row.classList.add('setting-toggle-row');control.classList.add('settings-switch');input.setAttribute('role','switch');
  const state=node('span','settings-switch-state');state.setAttribute('aria-hidden','true');control.append(state,input);
 }else if(input.type==='number'){
  row.classList.add('setting-number-row');const number=node('div','settings-number'),arrows=node('span','settings-stepper');
  for(const [direction,text,action]of [[1,'▴','Increase'],[-1,'▾','Decrease']]){const button=node('button','',text);button.type='button';button.dataset.settingStep=direction;button.setAttribute('aria-label',action+' '+caption);arrows.append(button);}
  number.append(input);if(unit)number.append(node('span','settings-unit',unit));number.append(arrows);control.append(number);
 }else{row.classList.add(input.tagName==='SELECT'?'setting-select-row':'setting-text-row');control.append(input);}
 row.append(label,control);return row;
}
function notes(title,children){const details=node('details','settings-notes');details.append(node('summary','',title),...children);return details;}
export function mountSettingsLayout(form,openGroups=new Map()){
 const source=form.querySelector('#settings-fields'),inputs=new Map([...source.querySelectorAll('[name]')].map(el=>[el.name,el]));
 if(inputs.size!==Object.keys(fields).length||[...inputs.keys()].some(name=>!fields[name]))throw Error('Settings layout does not match the existing settings fields.');
 const fieldsets=source.querySelectorAll('fieldset'),fuel=fieldsets[0],accommodation=fieldsets[1];
 const fuelEstimate=fuel.querySelector('#fuel-settings-estimate'),luggageEstimate=accommodation.querySelector('#luggage-estimate'),costEstimate=accommodation.querySelector('#accommodation-estimate');
 const fuelNotes=[...fuel.querySelectorAll(':scope > p')].filter(el=>el!==fuelEstimate),accommodationNotes=[...accommodation.querySelectorAll(':scope > p, :scope > details')],pricingNotes=[...source.querySelectorAll(':scope > p')];
 const recurringNotes=Object.fromEntries(['mortgage','maintenance'].map(kind=>[kind,[source.querySelector('#'+kind+'-settings-summary'),source.querySelector('#'+kind+'-settings-help')]]));
 const groupReferences={fuel:['bladders'],mortgage:['mortgage'],maintenance:['maintenance'],trader:['broker'],pricing:['profit'],cabins:['support-cost'],people:['accommodation'],support:['lss'],optional:['tax','insurance'],rounding:['rounding']};
 const columns=node('div','settings-columns'),left=node('div','settings-column'),right=node('div','settings-column');columns.append(left,right);
 for(const group of settingsGroups){
  const section=node('details','settings-section'),heading=node('summary','settings-section-heading'),title=node('div'),chevron=node('span','settings-disclosure','▸');
  section.dataset.settingsGroup=group.id;section.open=openGroups.get(group.id)??!group.advanced;
  const caption=node('h3','',group.title);caption.setAttribute('aria-label',group.title);for(const id of groupReferences[group.id]||[])caption.insertAdjacentHTML('beforeend',ruleInfo(id));title.append(caption,node('p','',group.description));chevron.setAttribute('aria-hidden','true');heading.append(title,chevron);heading.setAttribute('aria-label',group.title);
  section.append(heading);
  for(const name of group.names){if(name.startsWith('rooms-'))section.append(node('div','settings-band',name.slice(6)+' service'));section.append(settingRow(inputs.get(name)));}
  if(group.id==='fuel'){fuelEstimate.className='settings-note';section.append(fuelEstimate,notes('Fuel tracking details & rules',fuelNotes));}
  if(group.id==='cabins')section.append(notes('Cabin charges — rules & campaign assumptions',accommodationNotes));
  if(group.id==='people'){luggageEstimate.className='settings-note';section.append(luggageEstimate);}
  if(group.id==='support'){costEstimate.className='settings-note';section.append(notes('Current cabin costs & supplies',[costEstimate]));}
  if(group.id==='pricing')section.append(...pricingNotes.map(el=>{el.classList.add('settings-note');return el;}));
  if(recurringNotes[group.id])for(const el of recurringNotes[group.id]){el.className='settings-note';section.append(el);}
  if(group.id==='optional')section.append(node('p','settings-note','Turning insurance off hides open-policy panels. Policies reappear when enabled; closed policies remain in History.'));
  (['campaign','fuel','mortgage','maintenance','trader','pricing'].includes(group.id)?left:right).append(section);
 }
 source.replaceChildren(columns);
}
export function syncSettingsControls(form,readOnly=false){
 for(const button of form.querySelectorAll('[data-mutate]'))button.disabled=readOnly||button.hasAttribute('data-unavailable');
 for(const input of form.querySelectorAll('[name]')){
  // A read-only tab cannot change controls. Mode-dependent disabling is first
  // recalculated by the application's existing accommodation/profit logic.
  if(readOnly)input.disabled=true;
  const number=input.closest('.settings-number');if(number){number.classList.toggle('is-disabled',input.disabled);number.querySelectorAll('button').forEach(button=>button.disabled=input.disabled);}
  if(input.type==='checkbox')input.parentElement.querySelector('.settings-switch-state').textContent=input.checked?'On':'Off';
 }
}
export function stepSetting(button){
 const input=button.closest('.settings-number')?.querySelector('input');if(!input||input.disabled||button.disabled)return;
 // Native stepping honors min/max and step. step="any" still allows direct
 // fractional typing, with one-unit arrows matching the approved concept.
 const direction=Number(button.dataset.settingStep);
 if(input.step==='any'){
  let value=(Number(input.value)||0)+direction;
  if(input.min!=='')value=Math.max(Number(input.min),value);if(input.max!=='')value=Math.min(Number(input.max),value);
  input.value=String(value);
 }else if(direction>0)input.stepUp();else input.stepDown();
 input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));
}
