import {projectPlayerSnapshot} from './player-snapshot.mjs';

// Render only validated, detached data. All untrusted strings become text nodes.
export function renderPlayerSnapshot(root, input) {
  const document = root.ownerDocument;
  const node = (tag, content) => { const element = document.createElement(tag); if (content !== undefined) element.textContent = content; return element; };
  let data;
  try { data = projectPlayerSnapshot(input); }
  catch (error) { const message = node('p', error.message); message.setAttribute('role', 'alert'); root.replaceChildren(message); return false; }
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
  facts(section('Ship & journey'), [['Ship', data.ship.name], ['Cargo capacity', data.ship.cargoCapacityTons + ' t'], ['Fuel aboard', data.ship.fuelTons + ' t'], ['Planned destination', data.ship.destination], ['Campaign date', data.campaignDate]]);
  table(section('Cargo aboard'), ['Cargo lot', 'Tons'], data.cargo.map(row => [row.name, row.tons]), 'No cargo aboard.');
  for (const [key, title] of [['buy', 'Buy offers · crew purchases'], ['sell', 'Sell offers · crew sales']]) {
    const panel = section(title), market = data[key];
    panel.append(node('p', 'Prices in Credits per ton. Quotes only; no transactions.'));
    table(panel, ['Goods', 'Tons quoted', 'Cr / ton'], market.offers.map(row => [row.name, row.tons, row.creditsPerTon]), {'available':'Checked: no current offers.', 'not-checked':'Not checked. No prices available.', 'expired':'Expired. Ask the operator for fresh offers.'}[market.status]);
  }
  root.replaceChildren(node('p', 'Snapshot captured: ' + data.capturedAt + ' · Fixed information; does not update live.'), container);
  return true;
}
