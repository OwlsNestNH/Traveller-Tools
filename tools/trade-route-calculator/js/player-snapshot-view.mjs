import {projectPlayerSnapshot, summarizePlayerExpenses, EXPENSE_KINDS} from './player-snapshot.mjs';

// Render only validated, detached data. All untrusted strings become text nodes.
export function renderPlayerSnapshot(root, input) {
  const document = root.ownerDocument;
  const node = (tag, content) => { const element = document.createElement(tag); if (content !== undefined) element.textContent = content; return element; };
  let data;
  try { data = projectPlayerSnapshot(input); }
  catch (error) { const message = node('p', error.message); message.setAttribute('role', 'alert'); root.replaceChildren(message); return false; }
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
    for (const values of rows) { const row = node('tr'); for (const value of values) row.append(node('td', value)); body.append(row); }
    element.append(head, body); parent.append(element);
  };
  const planet = section('Planetary information');
  facts(planet, [['World', data.world.name], ['Location', data.world.location], ['UWP', data.world.uwp], ['Trade codes', data.world.tradeCodes], ['Travel zone', data.world.travelZone], ['Starport', data.world.starport]]);
  facts(section('Ship & journey'), [['Ship', data.ship.name], ['Cargo capacity', quantity(data.ship.cargoCapacityTons) + ' t'], ['Planned destination', data.ship.destination], ['Campaign date', data.campaignDate]]);
  const resources = section('Shipboard cash & supplies'); resources.className = 'wide';
  const resourceGrid = node('div'); resourceGrid.className = 'resource-grid'; resources.append(resourceGrid);
  const cash = node('div'); cash.className = 'resource'; cash.append(node('h3', 'Shipboard cash'), node('strong', credits(data.ship.cashCredits)), node('p', 'Current balance · expenses below are not deducted again.')); resourceGrid.append(cash);
  const gauge = (title, resource, unit, description) => {
    const panel = node('div'); panel.className = 'resource'; panel.append(node('h3', title));
    const label = quantity(resource.current) + (resource.current === null ? '' : ' ' + unit) + ' / ' + quantity(resource.capacity) + (resource.capacity === null ? ' capacity' : ' ' + unit + ' capacity');
    panel.append(node('strong', label));
    if (resource.current !== null && resource.capacity !== null && Number(resource.capacity) > 0) {
      const meter = node('meter'); meter.min = 0; meter.max = Number(resource.capacity); meter.value = Number(resource.current);
      meter.setAttribute('aria-label', title + ': ' + label); panel.append(meter);
    } else panel.append(node('p', resource.capacity !== null && Number(resource.capacity) === 0 ? 'No capacity configured.' : 'Fill level unavailable.'));
    panel.append(node('p', description)); resourceGrid.append(panel);
  };
  gauge('Main fuel tank', data.ship.fuel, 't', 'Fuel aboard / main tank capacity');
  gauge('Life support · internal stores', data.ship.lifeSupport, 'LSS', 'Physical supplies / internal capacity. Cargo-stored supplies: ' + quantity(data.ship.lifeSupport.cargoLss) + (data.ship.lifeSupport.cargoLss === null ? '' : ' LSS') + '.');
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
    const entry = data.expenses[kind], row = node('tr'), name = node('th'); name.scope = 'row'; name.append(node('span', labels[kind]), node('small', entry.basis));
    row.append(name, node('td', credits(entry.expected)), node('td', credits(entry.paid))); body.append(row);
  }
  expenseTable.append(head, body); details.append(expenseTable); expensePanel.append(details);
  const cargo = section('Cargo aboard'); cargo.className = 'wide';
  table(cargo, ['Cargo lot', 'Tons'], data.cargo.map(row => [row.name, row.tons]), 'No cargo aboard.');
  for (const [key, title] of [['buy', 'Buy offers · crew purchases'], ['sell', 'Sell offers · crew sales']]) {
    const panel = section(title), market = data[key];
    panel.append(node('p', 'Prices in Credits per ton. Quotes only; no transactions.'));
    table(panel, ['Goods', 'Tons quoted', 'Cr / ton'], market.offers.map(row => [row.name, row.tons, row.creditsPerTon]), {'available':'Checked: no current offers.', 'not-checked':'Not checked. No prices available.', 'expired':'Expired. Ask the operator for fresh offers.'}[market.status]);
  }
  root.replaceChildren(node('p', 'Snapshot captured: ' + data.capturedAt + ' · Fixed information; does not update live.'), container);
  return true;
}
