import {formatSnapshotTons, formatSnapshotWholeDown, formatSnapshotLss, formatSnapshotQuantityText} from './player-snapshot-format.mjs';
import {projectPlayerSnapshot, summarizePlayerExpenses, EXPENSE_KINDS} from './player-snapshot.mjs';

// Immutable transmitted data and local annotations remain separate.
// Persistence is supplied by the standalone recipient adapter, never campaign storage.
const labelsByRoot = new WeakMap();
const mapObservers = new WeakMap();
export function clearPlayerSnapshotMap(root) {mapObservers.get(root)?.disconnect();mapObservers.delete(root);}
// Render only validated, detached data. All untrusted strings become text nodes.
export function renderPlayerSnapshot(root, input, {annotations,onAnnotationsChange}={}) {
  clearPlayerSnapshotMap(root);
  const document = root.ownerDocument;
  const node = (tag, content) => { const element = document.createElement(tag); if (content !== undefined) element.textContent = content; return element; };
  let data;
  try { data = projectPlayerSnapshot(input); }
  catch (error) { const message = node('p', error.message); message.setAttribute('role', 'alert'); root.replaceChildren(message); return false; }
  const identity = JSON.stringify(data);
  let state = labelsByRoot.get(root);
  if (!state || state.identity !== identity) {state = {identity, labels:new Map()}; labelsByRoot.set(root,state);}
  if(annotations) state.labels=annotations;
  const localName = (row, list, index) => {
    if(row.name!=='Other') return row.name;
    const key=list+':'+index, wrap=node('div'), title=node('span'), note=node('small'), edit=node('button','Edit');
    edit.type='button';edit.setAttribute('aria-label','Edit local details for '+list+' lot '+(index+1));
    const refresh=()=>{const entry=state.labels.get(key);title.textContent=entry?.name||'Other';note.textContent=entry?.base!=null?'Local base: Cr '+entry.base+' / t · player estimate':'';};refresh();
    edit.addEventListener('click',()=>{
      const entry=state.labels.get(key)??{name:null,base:null}, dialog=node('dialog'), heading=node('h2','Other goods');heading.id='other-dialog-title';dialog.setAttribute('aria-labelledby',heading.id);
      dialog.append(heading,node('p',annotations?'Local to this snapshot, saved in this browser when storage is available.':'Example only. These local details clear when you reload.'));
      const field=(label,value,aria)=>{const unknown=node('input');unknown.type='checkbox';unknown.checked=value===null;const unknownLabel=node('label',label+' unknown');unknownLabel.prepend(unknown);const input=node('input');input.type='text';input.value=value??'';input.disabled=unknown.checked;input.setAttribute('aria-label',aria);const name=node('label',label);name.append(input);unknown.addEventListener('change',()=>{input.disabled=unknown.checked;});dialog.append(unknownLabel,name);return {unknown,input};};
      const name=field('Name',entry.name,'Local goods name');name.input.maxLength=80;
      const base=field('Base price',entry.base,'Local estimated base price');base.input.maxLength=22;base.input.inputMode='decimal';
      dialog.append(node('p',row.creditsPerTon!==undefined?'The operator’s quoted price stays unchanged. This base price is a separate player estimate in Credits per ton.':'Local estimates do not change the operator’s recorded retail, purchase percentage or paid price.'));
      const error=node('p');error.setAttribute('role','alert');const save=node('button','Save local details'),cancel=node('button','Cancel');save.type=cancel.type='button';
      save.addEventListener('click',()=>{
        const validName=name.unknown.checked||(name.input.value.trim().length>0&&name.input.value.length<=80&&name.input.value.isWellFormed()&&!/[\u0000-\u001f\u007f]/u.test(name.input.value));
        const validBase=base.unknown.checked||/^(0|[1-9]\d{0,14})(\.\d{1,6})?$/.test(base.input.value);
        if(!validName||!validBase){error.textContent='Enter a name and a nonnegative decimal price, or choose Unknown.';return;}
        state.labels.set(key,{name:name.unknown.checked?null:name.input.value,base:base.unknown.checked?null:base.input.value});onAnnotationsChange?.();refresh();dialog.close();
      });cancel.addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>{dialog.remove();edit.focus();});dialog.append(error,save,cancel);root.append(dialog);dialog.showModal();
    });wrap.append(title,edit,note);return wrap;
  };
  const quantity = value => value === null ? 'Unknown' : value.split('.').map((part, index) => index ? part : part.replace(/\B(?=(\d{3})+(?!\d))/g, ',')).join('.');
  const credits = value => value === null ? 'Unknown' : 'Cr ' + quantity(value);
  const container = node('div'); container.className = 'snapshot-grid';
  const section = title => { const element = node('section'); element.append(node('h2', title)); container.append(element); return element; };
  const facts = (parent, pairs) => { const list = node('dl'); for (const [label, value] of pairs) list.append(node('dt', label), node('dd', value)); parent.append(list); };
  const table = (parent, headings, rows, empty) => {
    if (!rows.length) { parent.append(node('p', empty)); return; }
    const element = node('table'), head = node('thead'), header = node('tr'), body = node('tbody');
    for (const heading of headings) { const th = node('th', heading); th.scope = 'col'; header.append(th); }
    head.append(header);
    for (const values of rows) { const row = node('tr'); for (const value of values) {const cell=node('td');cell.dataset.label=headings[row.children.length]; if (typeof value==='string') cell.textContent=value; else cell.append(value); row.append(cell);} body.append(row); }
    element.append(head, body); parent.append(element);
  };
  const planet = section('Planetary information');
  facts(planet, [['World', data.world.name], ['Location', data.world.location], ['UWP', data.world.uwp], ['Trade codes', data.world.tradeCodes], ['Travel zone', data.world.travelZone], ['Starport', data.world.starport]]);
  if(data.world.mapReference){const link=node('a','Open nearby-world reference');const url=new URL('player-map-preview.html',document.baseURI);url.search=new URLSearchParams(data.world.mapReference);link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';planet.append(link);}
  facts(section('Ship & journey'), [['Ship', data.ship.name], ['Cargo capacity', formatSnapshotTons(data.ship.cargoCapacityTons) + (data.ship.cargoCapacityTons===null?'':' t')], ['Planned destination', data.ship.destination], ['Campaign date', data.campaignDate]]);
  if(data.world.mapReference){
    const map=section('Nearby-world reference');map.className='wide snapshot-map';
    map.append(node('p','Live reference for '+data.world.mapReference.sector+' / '+data.world.mapReference.hex+'. Browsing does not change the frozen ship, cargo or offers.'));
    const frame=node('iframe'),url=new URL('player-map-preview.html',document.baseURI);url.search=new URLSearchParams({...data.world.mapReference,embedded:'1'});
    frame.title='Nearby-world reference map';frame.src=url.href;frame.referrerPolicy='no-referrer';frame.setAttribute('sandbox','allow-scripts allow-same-origin');frame.height='1000';
    frame.addEventListener('load',()=>{if(!frame.isConnected)return;const body=frame.contentDocument?.body;if(!body)return;const resize=()=>{if(frame.isConnected)frame.height=String(Math.min(2400,Math.max(320,Math.ceil(body.scrollHeight)+24)));};const observer=new ResizeObserver(resize);mapObservers.set(root,observer);observer.observe(body);resize();});map.append(frame);
  }
  const resources = section('Shipboard cash & supplies'); resources.className = 'wide';
  const resourceGrid = node('div'); resourceGrid.className = 'resource-grid'; resources.append(resourceGrid);
  const cash = node('div'); cash.className = 'resource'; cash.append(node('h3', 'Shipboard cash'), node('strong', credits(data.ship.cashCredits)), node('p', 'Current balance · expenses below are not deducted again.')); resourceGrid.append(cash);
  const gauge = (title, resource, unit, description) => {
    const panel = node('div'); panel.className = 'resource'; panel.append(node('h3', title));
    const format = unit==='t' ? formatSnapshotWholeDown : quantity;
    const label = format(resource.current) + (resource.current === null ? '' : ' ' + unit) + ' / ' + format(resource.capacity) + (resource.capacity === null ? ' capacity' : ' ' + unit + ' capacity');
    panel.append(node('strong', label));
    if (resource.current !== null && resource.capacity !== null && Number(resource.capacity) > 0) {
      const meter = node('meter'); meter.min = 0; meter.max = Number(resource.capacity); meter.value = Number(resource.current);
      meter.setAttribute('aria-label', title + ': ' + label); panel.append(meter);
    } else panel.append(node('p', resource.capacity !== null && Number(resource.capacity) === 0 ? 'No capacity configured.' : 'Fill level unavailable.'));
    panel.append(node('p', description)); resourceGrid.append(panel);
  };
  gauge('Fuel tanks', data.ship.fuel, 't', 'Fuel aboard / total tank capacity');
  gauge('Life support · internal days remaining', {current:data.ship.lifeSupport.daysRemaining,capacity:data.ship.lifeSupport.daysCapacity}, 'days', data.ship.lifeSupport.daysRemaining===null ? 'Days unknown: duration for the current crew and passengers was not supplied. Supply stock has not been converted into days.' : 'Internal supplies only, at this snapshot’s crew and passenger consumption. Cargo reserve is shown separately.');
  const expensePanel = section('Current-system expenses'); expensePanel.className = 'wide';
  expensePanel.append(node('p', data.expenses.visitLabel));
  const totals = summarizePlayerExpenses(data.expenses), totalGrid = node('div'); totalGrid.className = 'expense-totals';
  for (const [column, label] of [['expected', 'Expected for this stop'], ['paid', 'Already paid this stop']]) {
    const total = totals[column], card = node('div'); card.append(node('h3', label), node('strong', credits(total.unknownCount === 6 ? null : total.knownTotal)));
    card.append(node('p', total.unknownCount ? 'Known subtotal · ' + total.unknownCount + ' of 6 amounts unknown' : 'Total · all 6 amounts known'));
    totalGrid.append(card);
  }
  expensePanel.append(totalGrid, node('p', 'Expected includes amounts already paid; it is a visit plan, not a balance due. Unknown amounts are excluded from subtotals.'));
  const details = node('details'), summary = node('summary', 'Show expense details · 6 categories'); details.append(summary);
  const expenseTable = node('table'); expenseTable.className = 'expense-table';
  const head = node('thead'), heading = node('tr');
  for (const label of ['Expense / basis', 'Expected', 'Paid']) { const cell = node('th', label); cell.scope = 'col'; heading.append(cell); } head.append(heading);
  const body = node('tbody'), labels = {berth:'Berth', fuel:'Fuel', salary:'Salary', mortgage:'Mortgage', lss:'Life support (LSS)', incidentals:'Incidentals'};
  for (const kind of EXPENSE_KINDS) {
    const entry = data.expenses[kind], row = node('tr'), name = node('th'); name.scope = 'row'; name.append(node('span', labels[kind]), node('small', formatSnapshotQuantityText(entry.basis,{fuel:kind==='fuel'})));
    row.append(name, node('td', credits(entry.expected)), node('td', credits(entry.paid))); body.append(row);
  }
  expenseTable.append(head, body); details.append(expenseTable); expensePanel.append(details);
  const cargo = section('Cargo aboard'); cargo.className = 'wide cargo-section';
  table(cargo, ['Cargo lot', 'Tons', 'Retail / ton', 'Purchase % of retail', 'Paid / ton', 'Paid / lot'], data.cargo.map((row,i) => [localName(row,'cargo',i), formatSnapshotTons(row.tons), credits(row.purchase?.retailPerTon ?? null), row.purchase?.percent == null ? 'Unknown' : quantity(row.purchase.percent)+'%', credits(row.purchase?.paidPerTon ?? null), credits(row.purchase?.paidTotal ?? null)]), 'No cargo aboard.');
  if(data.cargo.length)cargo.append(node('p','Retail is the recorded base price per ton. Purchase % is the actual recorded percentage before credit rounding. Paid / lot covers the tons shown. Unit and lot costs round independently, so multiplying the displayed unit price may differ from the displayed lot total. Missing purchase history stays Unknown; local estimates do not fill it in.'));
  const support=data.ship.lifeSupport;
  if((support.cargoLss!==null&&Number(support.cargoLss)>0)||(support.cargoReservedTons!==null&&Number(support.cargoReservedTons)>0)) {
    facts(cargo,[['Life support overflow · reserved space',formatSnapshotTons(support.cargoReservedTons)+(support.cargoReservedTons===null?'':' t')]]);
    cargo.append(node('p',formatSnapshotLss(support.cargoLss)+(support.cargoLss===null?'':' LSS')+' of reserve stock (display rounded down). Reserved space is separate from cargo lots; it is not extra supply stock or an addition to internal days.'));
  }
  for (const [key, title] of [['buy', 'Buy offers · crew purchases'], ['sell', 'Sell offers · crew sales']]) {
    const panel = section(title), market = data[key];
    panel.append(node('p', 'Prices in Credits per ton. Quotes only; no transactions.'));
    table(panel, ['Goods', 'Tons quoted', 'Cr / ton'], market.offers.map((row,i) => [localName(row,key,i), formatSnapshotTons(row.tons), row.creditsPerTon]), {'available':'Checked: no current offers.', 'not-checked':'Not checked. No prices available.', 'expired':'Expired. Ask the operator for fresh offers.'}[market.status]);
  }
  root.replaceChildren(node('p', 'Snapshot captured: ' + data.capturedAt + ' · Fixed information; does not update live.'), node('p', 'Fuel quantities and tank capacities round down to whole tons; cargo and reserved space round up. LSS stock rounds down to whole units. Display rounding may make amounts differ from totals or costs. Stored amounts, prices and fill bars remain exact.'), container);
  return true;
}
