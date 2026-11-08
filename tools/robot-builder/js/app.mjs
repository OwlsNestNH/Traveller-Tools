import { createRobotApi } from './api.mjs';

const $ = id => document.getElementById(id);
const stages = [
  ['chassis', 'Chassis Size'], ['locomotion', 'Locomotion'],
  ['physical', 'Physical Options'], ['brain', 'Robot Brain'],
  ['skills', 'Skill Packages'], ['finalisation', 'Finalisation'],
];
const categories = [
  ['chassis-modifications', 'Chassis Modifications'],
  ['locomotive-modifications', 'Locomotive Modifications'],
  ['manipulator-modification', 'Manipulator Modification'],
  ['default-suites', 'Default Suites'], ['zero-slot-options', 'Zero-Slot Options'],
  ['slot-cost-options', 'Slot Cost Options'], ['weapons', 'Weapons'],
];
let api;
let view;
let currentStage = 'chassis';
let physicalCategory = 'chassis-modifications';
const searches = new Map();
const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const el = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};
function notify(message, error = false) {
  $('notice').textContent = message;
  $('notice').classList.toggle('error', error);
}
async function safely(action, success) {
  try {
    const result = await action();
    if (success) notify(success);
    return result;
  } catch (error) {
    notify(error.message || 'This action could not be completed.', true);
    if (api) render(api.getView());
    return null;
  }
}
function option(id, label) { const node = el('option', label); node.value = id; return node; }
function numericPicker(control, value, onChange) {
  const min = Number(control.min), max = Number(control.max), step = Number(control.step ?? 1);
  const count = Math.floor((max - min) / step) + 1;
  if (Number.isFinite(min) && Number.isFinite(max) && step > 0 && count > 0 && count <= 1001) {
    const input = el('select');
    selectChoices(input, Array.from({ length: count }, (_, i) => ({ id: min + i * step, label: String(min + i * step) })), value);
    input.addEventListener('change', () => onChange(input.value === '' ? null : Number(input.value)));
    return input;
  }
  const input = el('input'); input.type = 'number'; input.value = value ?? '';
  for (const key of ['min', 'max', 'step']) if (control[key] !== undefined) input[key] = control[key];
  input.addEventListener('change', () => onChange(input.value === '' ? null : Number(input.value)));
  return input;
}
function choiceLabel(choice) { return choice.label + (choice.eligibility?.available === false ? ' (' + choice.eligibility.reason + ')' : choice.implemented === false ? ' (not yet implemented)' : ''); }
function sourceText(source) {
  if (!source) return '';
  if (typeof source === 'string') return source;
  return [source.title || source.book, source.page ? `p. ${source.page}` : source.pages, source.note].filter(Boolean).join(' · ');
}
function selectChoices(select, choices, selected, placeholder = 'Choose an option') {
  const prompt = option('', placeholder); prompt.disabled = true;
  select.replaceChildren(prompt);
  for (const choice of choices || []) select.append(option(choice.id, choiceLabel(choice)));
  if (selected !== undefined && selected !== null && selected !== '' && ![...select.options].some(item => item.value === String(selected))) {
    select.append(option(selected, `${selected} · unavailable selection`));
  }
  select.value = selected ?? '';
}
function updateIdentity() {
  selectChoices($('robot-kind'), view.catalogue.kinds, view.design.kind, 'Choose robot type');
  $('robot-name').value = view.design.name || '';
  const levels = view.catalogue.techLevels || [];
  selectChoices($('robot-tl'), levels.map(item => typeof item === 'number' ? { id: item, label: `TL ${item}` } : item), view.design.techLevel, 'Choose TL');
  const kind = view.catalogue.kinds.find(item => item.id === view.design.kind);
  $('type-note').textContent = kind?.description || kind?.note || (kind?.implemented === false ? 'This type has distinct construction rules that are not yet implemented. Selections may be explored, but this design cannot be verified.' : 'Choose the robot type first, then visit any construction stage. Your selections stay with the design.');
}
function renderNavigation() {
  $('stage-nav').replaceChildren(...stages.map(([id, label], i) => {
    const button = el('button', undefined, id === currentStage ? 'stage-button active' : 'stage-button');
    button.type = 'button';
    button.append(el('span', String(i + 1), 'stage-number'), el('span', label));
    button.setAttribute('aria-controls', 'stage-panel');
    if (id === currentStage) button.setAttribute('aria-current', 'step');
    button.addEventListener('click', () => {
      currentStage = id;
      renderNavigation();
      renderStage();
      $('stage-panel').focus({ preventScroll: true });
    });
    return button;
  }));
}
function selectedValue(control) { return control.target === 'special' ? view.design.special?.[control.field] : view.design.selections?.[currentStage]?.[control.field]; }
function submitSelection(control, value) {
  safely(() => api.select({ stage: currentStage, field: control.field, value }));
}
function renderControl(control, choicesOverride) {
  const field = el('div', undefined, 'field');
  const id = `field-${currentStage}-${control.field}${control.category ? `-${control.category}` : ""}`;
  const label = el('label', control.label); label.htmlFor = id; field.append(label);
  const choices = choicesOverride || control.choices || [];
  const selected = selectedValue(control);
  if (control.type === 'option-parameters') {
    field.classList.add('wide');
    const all = view.design.selections.physical;
    const settings = selected || {};
    const installed = new Set([...(all.options || []),...(all.defaultSuite || [])]);
    let shown=0;
    for(const choice of choices.filter(item=>installed.has(item.id))) {
      const controls=(choice.parameterControls || []).filter(item=>item.field!=='quantity'||!(all.defaultSuite||[]).includes(choice.id));
      if(!controls.length)continue;
      shown++;
      const card=el('div',undefined,'option-settings');card.append(el('h4',choice.label));
      const grid=el('div',undefined,'fields-grid');
      for(const item of controls) {
        const row=el('label',item.label);const fieldId=id+'-'+choice.id+'-'+item.field;row.htmlFor=fieldId;
        const value=settings[choice.id]?.[item.field] ?? item.default ?? '';
        const change=value=>submitSelection(control,{...settings,[choice.id]:{...(settings[choice.id]||{}),[item.field]:value}});
        let input;
        if(item.type==='number') input=numericPicker(item,value,change);
        else if(item.type==='select') {input=el('select');selectChoices(input,item.choices,value);input.addEventListener('change',()=>change(item.choices.find(c=>String(c.id)===input.value)?.id??null));}
        else {input=el('input');input.type='text';input.value=value;input.maxLength=item.maxLength||200;input.addEventListener('change',()=>change(input.value));}
        input.id=fieldId;row.append(input);grid.append(row);
      }
      card.append(grid);if(choice.source)card.append(el('p',sourceText(choice.source),'source'));field.append(card);
    }
    if(!shown)return el('span',undefined,'empty-settings');
  } else if (control.type === 'manipulators') {
    field.classList.add('wide');
    if (!control.itemFields?.length) {
      field.append(el('p', 'Manipulator editing is not available in this preview. Existing manipulators are retained in the design.', 'help'));
      return field;
    }
    const arms = Array.isArray(selected) ? selected : [];
    const update = (armId, patch) => submitSelection(control, arms.map(arm => arm.id === armId ? { ...arm, ...patch } : arm));
    for (const [index, arm] of arms.entries()) {
      const card = el('div', undefined, 'manipulator');
      const heading = el('div', undefined, 'manipulator-heading');
      heading.append(el('h3', `${arm.kind === 'base' ? 'Base arm' : arm.kind === 'leg' ? 'Converted leg' : 'Additional arm'} ${index + 1}`));
      const remove = el('button', 'Remove'); remove.type = 'button';
      remove.setAttribute('aria-label', `Remove ${arm.id}`);
      remove.addEventListener('click', () => submitSelection(control, arms.filter(item => item.id !== arm.id)));
      heading.append(remove); card.append(heading);
      const grid = el('div', undefined, 'fields-grid');
      for (const item of control.itemFields) {
        const itemId = `${id}-${arm.id}-${item.field}`;
        const row = el('label', item.label); row.htmlFor = itemId;
        let input;
        if (item.type === 'select') {
          input = el('select'); selectChoices(input, item.choices, arm[item.field]);
          input.addEventListener('change', () => { const choice = item.choices.find(value => String(value.id) === input.value); if (choice) update(arm.id, { [item.field]: choice.id }); });
        } else {
          input = numericPicker(item, arm[item.field], value => update(arm.id, { [item.field]: value }));
        }
        input.id = itemId; row.append(input); grid.append(row);
      }
      card.append(grid); field.append(card);
    }
    const actions = el('div', undefined, 'file-actions');
    const addArm = (kind, armId) => {
      const arm = { id: armId || `arm-${globalThis.crypto.randomUUID()}`, kind };
      for (const item of control.itemFields) arm[item.field] = item.default ?? (item.type === 'select' ? item.choices[0].id : item.min ?? 0);
      submitSelection(control, [...arms, arm]);
    };
    for (const kind of control.kinds || []) {
      const button = el('button', `Add ${kind.label.toLowerCase()}`); button.type = 'button';
      button.addEventListener('click', () => addArm(kind.id)); actions.append(button);
    }
    for (const baseId of control.baseIds || []) if (!arms.some(arm => arm.id === baseId)) {
      const button = el('button', `Restore ${baseId.replace('-', ' ')}`); button.type = 'button';
      button.addEventListener('click', () => addArm('base', baseId)); actions.append(button);
    }
    field.append(actions);
  } else if (control.type === 'multiselect') {
    field.classList.add('wide');
    const chosen = Array.isArray(selected) ? selected : [];
    const picker = el('div', undefined, 'option-picker');
    const select = el('select'); select.id = id; select.setAttribute('aria-label', control.label);
    const add = el('button', 'Add'); add.type = 'button'; add.className = 'primary';
    const sourceHint = el('p', undefined, 'help source');
    let filter;
    const draw = () => {
      const current = select.value;
      const query = (filter?.value || '').trim().toLowerCase();
      const available = choices.filter(choice => !chosen.includes(choice.id) && choice.label.toLowerCase().includes(query));
      selectChoices(select, available, current, available.length ? 'Choose an option' : 'No matching options');
      add.disabled = !select.value || !available.some(choice => String(choice.id) === select.value);
      sourceHint.textContent = sourceText(available.find(choice => String(choice.id) === select.value)?.source);
    };
    if (choices.length > 16) {
      filter = el('input'); filter.type = 'search'; filter.placeholder = 'Find a book option';
      filter.setAttribute('aria-label', 'Search ' + control.label);
      filter.value = searches.get(id) || '';
      filter.addEventListener('input', () => { searches.set(id, filter.value); draw(); }); field.append(filter);
    }
    select.addEventListener('change', () => {
      const choice = choices.find(item => String(item.id) === select.value);
      add.disabled = !choice; sourceHint.textContent = sourceText(choice?.source);
    });
    add.addEventListener('click', () => {
      const choice = choices.find(item => String(item.id) === select.value);
      if (choice) submitSelection(control, [...chosen, choice.id]);
    });
    picker.append(select, add); field.append(picker, sourceHint); draw();
    const installed = el('div', undefined, 'installed-list');
    for (const choiceId of chosen.filter(value => choices.some(choice => choice.id === value))) {
      const choice = choices.find(item => item.id === choiceId);
      const row = el('div', undefined, 'installed-row');
      const description = el('div'); description.append(el('strong', choiceLabel(choice)));
      const source = sourceText(choice.source); if (source) description.append(el('small', source, 'source'));
      const remove = el('button', 'Remove'); remove.type = 'button'; remove.setAttribute('aria-label', 'Remove ' + choice.label);
      remove.addEventListener('click', () => submitSelection(control, chosen.filter(value => value !== choiceId)));
      row.append(description,remove); installed.append(row);
    }
    if (!installed.children.length) installed.append(el('p','No added options in this category.','help'));
    field.append(installed);

  } else {
    let input;
    if (control.type === 'number') {
      input = numericPicker(control, selected, value => submitSelection(control, value));
    } else {
      input = el('select'); selectChoices(input, choices, selected);
      input.addEventListener('change', () => submitSelection(control, choices.find(choice => String(choice.id) === input.value)?.id ?? null));
    }
    input.id = id; field.append(input);
  }
  if (control.description || control.help) field.append(el('p', control.description || control.help, 'help'));
  const source = sourceText(control.source); if (source) field.append(el('p', source, 'source'));
  if (control.type !== 'multiselect' && control.choices?.length === 0) field.append(el('p', 'Book choices pending verification. No custom values are substituted.', 'help'));
  return field;
}
function renderStage() {
  const index = stages.findIndex(([id]) => id === currentStage);
  $('stage-position').textContent = `STAGE ${index + 1} OF 6`;
  $('stage-title').textContent = stages[index][1];
  const content = $('stage-content'); content.replaceChildren();
  const sourceStage = view.catalogue.stages.find(item => item.id === currentStage);
  const stage = sourceStage ? { ...sourceStage, controls: sourceStage.controls.filter(control => !control.visibleWhen || (control.target === 'special' ? view.design.special?.[control.visibleWhen.field] : view.design.selections[currentStage]?.[control.visibleWhen.field]) === control.visibleWhen.equals) } : null;
  if (stage?.description) content.append(el('p', stage.description, 'stage-description'));
  if (currentStage === 'physical' && (stage?.controls || []).some(control=>control.category || control.choices?.some(choice=>choice.category))) {
    const layout = el('div', undefined, 'category-layout');
    const navigation = el('div', undefined, 'category-picker');
    const label = el('label', 'Physical-option category'); label.htmlFor = 'physical-category';
    const picker = el('select'); picker.id = 'physical-category';
    selectChoices(picker,categories.map(([id,label])=>({id,label})),physicalCategory);
    picker.addEventListener('change',()=>{physicalCategory=picker.value;renderStage();});
    label.append(picker);navigation.append(label,el('p','Choose a category to keep the workspace focused. Installed options remain with the design.','help'));
    const body = el('div', undefined, 'category-content');
    const category = categories.find(([id])=>id===physicalCategory) || categories[0];
    const [categoryId,labelText] = category;
    body.append(el('h3',labelText));
    const controls = (stage?.controls || []).filter(control => control.category === categoryId || control.category === labelText);
    for (const control of controls) body.append(renderControl(control));
    for (const control of (stage?.controls || []).filter(control => !control.category)) {
      const choices = (control.choices || []).filter(choice => choice.category === categoryId || choice.category === labelText);
      if (choices.length) body.append(renderControl({ ...control, label:labelText, category:categoryId }, choices));
    }
    if (body.children.length===1) body.append(el('p','This category is awaiting verified book choices.','help'));
    layout.append(navigation,body);content.append(layout);

  } else if (currentStage === 'finalisation') {
    content.append(el('p', 'Review the statblock and outstanding checks before using this robot in play.', 'stage-description'));
    const pre = el('pre', typeof api.getStatblock === 'function' ? api.getStatblock() : view.statblock || 'Statblock is not available yet.', 'statblock');
    for (const control of stage?.controls || []) content.append(renderControl(control));
    content.append(pre);
  } else {
    const grid = el('div', undefined, 'fields-grid');
    for (const control of stage?.controls || []) grid.append(renderControl(control));
    if (!grid.children.length) grid.append(el('p', 'This stage is awaiting source-verified construction choices.', 'help'));
    content.append(grid);
  }
  if (stage?.note) content.append(el('p', stage.note, 'scope-note'));
}
function metric(label, value) { const row = el('div', undefined, 'metric'); row.append(el('dt', label), el('dd', value)); return row; }
function formatted(value, suffix = '') { return typeof value === 'number' && Number.isFinite(value) ? `${number.format(value)}${suffix}` : 'Not calculated'; }
function renderSummary() {
  const evaluation = view.evaluation;
  $('design-status').textContent = { verified: evaluation.coverage?.complete === false ? 'Subset checked' : 'Verified', invalid: 'Needs correction', blocked: 'Rules incomplete' }[evaluation.status] || 'Not verified';
  $('design-status').className = `tag ${evaluation.status === 'verified' ? 'success' : 'review'}`;
  const totals = evaluation.totals;
  const list = el('dl', undefined, 'metrics');
  list.append(metric('Total cost', totals?.cost != null ? `Cr ${formatted(totals.cost)}` : 'Not calculated'));
  for (const [key, label] of [['slots', 'Slots'], ['bandwidth', 'Bandwidth']]) {
    list.append(metric(label, totals?.[key] ? `${formatted(totals[key].used)} / ${formatted(totals[key].capacity)}` : 'Not calculated'));
  }
  $('summary-metrics').replaceChildren(list);
  const stats = el('dl',undefined,'quick-stats');
  for(const [key,label] of [['hits','Hits'],['armour','Protection'],['intelligence','Intelligence'],['tacticalSpeed','Move / action']]) {
    if (totals?.[key] != null) stats.append(metric(label,formatted(totals[key],key==='tacticalSpeed'?' m':'')));
  }
  $('summary-metrics').append(stats);
  const compact = [['Cost',totals?.cost!=null?'Cr '+formatted(totals.cost):'Pending'],['Slots',totals?.slots?formatted(totals.slots.used)+' / '+formatted(totals.slots.capacity):'--'],['Bandwidth',totals?.bandwidth?formatted(totals.bandwidth.used)+' / '+formatted(totals.bandwidth.capacity):'--']];
  $('compact-summary').replaceChildren(...compact.map(([label,value])=>{const span=el('span',label);span.append(el('b',value));return span;}));
  const diagnostics = evaluation.diagnostics || [];
  $('issues').replaceChildren(...diagnostics.map(issue => {
    const node = el('div', undefined, `issue ${issue.severity}`); node.append(el('p', issue.message));
    const source = sourceText(issue.source); if (source) node.append(el('small', source, 'source')); return node;
  }));
  if (!diagnostics.length) $('issues').append(el('p', evaluation.status === 'verified' ? 'No outstanding construction checks.' : 'Construction rules have not been fully verified.', 'help'));
  const coverage = evaluation.coverage || view.catalogue.coverage;
  if (coverage?.gaps?.length) {
    const details = el('details', undefined, 'coverage'); details.append(el('summary', 'Implementation coverage'));
    if (coverage.scope) details.append(el('p', coverage.scope, 'help'));
    for (const gap of coverage.gaps) details.append(el('p', typeof gap === 'string' ? gap : gap.message, 'help'));
    $('issues').append(details);
  }
}
function renderSaved() {
  const selected = $('saved-design').value;
  const saved = view.savedDesigns || api.listSaved();
  $('saved-design').replaceChildren(option('', 'Choose a saved design'), ...saved.map(item => option(item.id, item.name || item.design?.name || 'Unnamed robot')));
  if (saved.some(item => item.id === selected)) $('saved-design').value = selected;
  $('load-design').disabled = !$('saved-design').value;
  $('save-design').disabled = view.storageStatus?.canSave === false;
  $('save-copy').disabled = view.storageStatus?.canSave === false;
  $('new-design').disabled = view.busy;
  $('refresh-saved').disabled = view.busy;
  $('storage-note').textContent = typeof view.storageStatus === 'string' ? view.storageStatus : view.storageStatus?.message || 'Saved designs stay in this browser. Export JSON to keep a portable backup.';
}
function renderExamples() {
  const selected = $('example-design').value;
  const examples = api.listExamples?.() || [];
  $('example-design').replaceChildren(option('', 'Choose an example'), ...examples.map(item => option(item.id, item.name || item.label)));
  if (examples.some(item => item.id === selected)) $('example-design').value = selected;
  $('load-example').disabled = !$('example-design').value || view.busy;
  $('example-note').textContent = examples.length ? 'Examples replace the draft without changing your saved designs.' : 'No construction examples are available yet.';
}
function render(next) {
  view = next || api.getView();
  const focused = document.activeElement?.id;
  updateIdentity(); renderNavigation(); renderStage(); renderSummary(); renderSaved(); renderExamples();
  if (focused && $(focused)) $(focused).focus({ preventScroll: true });
}
function download() {
  const result = api.exportDesign();
  const json = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const anchor = el('a'); anchor.href = url;
  anchor.download = `${(view.design.name || 'robot-design').replace(/[^a-z0-9_-]+/gi, '-').slice(0, 80)}.json`;
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function printDesign() {
  const output = $('print-output');
  output.replaceChildren(el('h1', view.design.name || 'Robot design'), el('pre', api.getStatblock?.() || view.statblock || 'Statblock unavailable.'));
  window.print();
}
try {
  api = createRobotApi();
  api.subscribe(render);
  render(api.getView());
  $('robot-kind').addEventListener('change', event => {
    if (view.dirty && !window.confirm('Changing robot type resets construction choices for the new rules. Save or export first to keep this design. Continue?')) { event.target.value = view.design.kind; return; }
    safely(() => api.setIdentity({ kind: event.target.value }));
  });
  $('robot-name').addEventListener('change', event => safely(() => api.setIdentity({ name: event.target.value })));
  $('robot-tl').addEventListener('change', event => safely(() => api.setIdentity({ techLevel: Number(event.target.value) })));
  $('saved-design').addEventListener('change', () => { $('load-design').disabled = !$('saved-design').value; });
  $('new-design').addEventListener('click', () => {
    if (view.dirty && !window.confirm('Start a new blank design and replace your unsaved changes? Save or export first to keep them.')) return;
    safely(() => api.newDesign(view.design.kind), 'New design started.');
  });
  $('refresh-saved').addEventListener('click', () => safely(() => api.refreshSaved(), 'Saved list refreshed. Your current draft is unchanged.'));
  $('example-design').addEventListener('change', () => { $('load-example').disabled = !$('example-design').value || view.busy; });
  $('load-example').addEventListener('click', () => {
    if (view.dirty && !window.confirm('Load this example and replace your unsaved changes? Save or export first to keep them.')) return;
    safely(() => api.loadExample($('example-design').value), 'Example loaded as an unsaved draft.');
  });
  window.addEventListener('beforeunload', event => {
    if (view.dirty || view.busy || $('robot-name').value !== (view.design.name || '')) { event.preventDefault(); event.returnValue = ''; }
  });
  $('save-design').addEventListener('click', () => safely(() => api.saveDesign(), 'Design saved.'));
  $('save-copy').addEventListener('click', () => safely(() => api.saveDesign({ asNew: true }), 'New design copy saved.'));
  $('load-design').addEventListener('click', () => {
    if (view.dirty && !window.confirm('Load this design and replace your current unsaved changes? Export or save first to keep them.')) return;
    safely(() => api.loadDesign($('saved-design').value), 'Design loaded.');
  });
  $('export-design').addEventListener('click', () => safely(download, 'JSON export prepared.'));
  $('import-design').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', async event => {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error('This JSON file is too large. Choose a robot design smaller than 2 MB.');
      if (view.dirty && !window.confirm('Import this design and replace your current unsaved changes?')) return;
      const json = await file.text(); safely(() => api.importDesign(json), 'Design imported. Save it to keep it in this browser.');
    } catch (error) { notify(error.message, true); }
    finally { event.target.value = ''; }
  });
  $('print-design').addEventListener('click', () => safely(printDesign));
} catch (error) {
  $('stage-content').replaceChildren(el('p', 'The construction workbench could not start. Your saved designs have not been changed.', 'error'));
  notify(error.message || 'Please reload the page and try again.', true);
}
