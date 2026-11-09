// Text nodes only. This renderer has no rules, storage, artwork or network access.
export function renderSheet(sheet, doc = document) {
  const el = (tag, text, className) => {
    const node = doc.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const root = el('article',undefined,'robot-sheet');
  root.setAttribute('aria-label','Robot reference sheet');
  root.append(el('p',sheet.kind,'sheet-kind'));
  const status = el('p',sheet.status,'sheet-status');
  if(sheet.provisionalLabel) status.append(el('span',' · '+sheet.provisionalLabel));
  if(sheet.unavailable) status.append(el('span',' · Totals unavailable; selections only'));
  root.append(status);
  const summary = el('dl',undefined,'sheet-summary');
  for(const item of sheet.summary) {
    const cell = el('div',undefined,'sheet-metric');
    cell.append(el('dt',item.label),el('dd',item.value));
    if(item.detail)cell.append(el('dd',item.detail,'sheet-detail'));
    summary.append(cell);
  }
  root.append(summary);
  if(sheet.constructionCost)root.append(el('p',sheet.constructionCost,'sheet-cost'));
  const entry = (item, showSource = false) => {
    const span = el('span',undefined,'sheet-entry');
    if(item.label)span.append(el('strong',item.label+(item.value?': ':'')));
    span.append(el('span',item.value));
    if(item.detail)span.append(el('span',' ('+item.detail+')','sheet-detail'));
    if(showSource && item.source)span.append(el('span',' ['+item.source+']','sheet-source'));
    return span;
  };
  const body = el('dl',undefined,'sheet-body');
  for(const group of sheet.body) {
    const row = el('div',undefined,'sheet-row');
    row.dataset.section = group.id;
    const content = el('dd');
    if(group.entries.length) group.entries.forEach((item,index) => {
      if(index)content.append(el('span','; ','sheet-separator'));
      content.append(entry(item));
    });
    else content.append(el('span',group.empty || 'Unresolved'));
    if(group.note && group.entries.length)content.append(el('small',group.note,'sheet-note'));
    row.append(el('dt',group.label),content);
    body.append(row);
  }
  root.append(body);
  for(const group of [...sheet.supplements,{id:'checks',title:'Checks and qualifications',rows:sheet.checks}]) {
    if(!group.rows.length)continue;
    const section = el('section',undefined,'sheet-supplement');
    section.dataset.section = group.id;
    section.append(el('h3',group.title));
    if(group.note)section.append(el('p',group.note,'sheet-note'));
    const list = el('ul');
    for(const row of group.rows) {
      const item=el('li'); item.append(entry(row,true));
      for(const detail of row.details || []) item.append(el('span','; '),entry(detail));
      list.append(item);
    }
    section.append(list);root.append(section);
  }
  if(sheet.sources?.length)root.append(el('p','Sources: '+sheet.sources.join('; '),'sheet-note sheet-sources'));
  root.append(el('p',sheet.footer,'sheet-footer'));
  return root;
}
