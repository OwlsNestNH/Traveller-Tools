// Origin screens consume projected choices, never the source tables.
const sourcePages = { 'aslan-family': 17, 'aslan-birth-order': 16, 'aslan-estate': 17, 'aslan-clan': 18, 'aslan-pride': 18, 'aslan-rite': 21 };
function familyEvidence(origin, esc) {
  return '<p class="notice">Recorded family SOC: <strong>' + esc(origin.familySOC) + '</strong>. Family land is recorded separately from personal ownership.</p>';
}
function reasonField(disabled) {
  return '<label>Source basis and GM reason<textarea id="aslan-origin-reason" rows="3" maxlength="500"' + disabled + '></textarea></label>';
}
export function aslanOriginView(state, {esc, button, sourceLabel}) {
  const origin = state.currentAslanOrigin;
  if (!origin) return '<p class="warning">The Aslan origin record is unavailable. Preserve your save and log.</p>';
  const disabled = state.config.gm ? '' : ' disabled';
  const help = !state.config.gm ? '<p class="help">Enable GM changes to record a source ruling.</p>' : '';
  const start = '<p class="source">' + esc(sourceLabel('aliens', origin.canRollGender ? 16 : sourcePages[state.stage] ?? 17)) + '</p>' + familyEvidence(origin, esc);
  if (state.stage === 'aslan-family') {
    if (origin.canRollGender) return start + button('Roll gender', 'roll-aslan-gender');
    return start + '<p>Family awards are recorded separately from the ordinary background skill allowance.</p>' + button('Roll family background', 'roll-aslan-family');
  }
  if (state.stage === 'aslan-birth-order') return start + button('Roll birth order', 'roll-aslan-birth-order');
  if (state.stage === 'aslan-estate') {
    const options = origin.estateOptions;
    if (!options) return start + '<p class="warning">The estate options are unavailable. Preserve your save and log.</p>';
    if (options.printedMinimumAvailable) return start + '<p>' + (options.minimumParcels === null ? 'There is no printed family estate at this SOC. ' : 'Record the printed family baseline. ') + 'This does not grant land, cash or present ownership.</p>' + button('Record family land baseline', 'resolve-aslan-estate', '', 'data-method="printed-minimum"');
    return start + '<p class="warning">This family SOC has no printed estate row. Record a sourced referee baseline without granting ownership.</p><div class="form-grid"><label>Minimum family parcels<input id="aslan-estate-parcels" type="number" min="0" max="9007199254740991" step="1"' + disabled + '></label><label>Increment<input id="aslan-estate-increment" type="number" min="0" max="9007199254740991" step="1"' + disabled + '></label></div>' + reasonField(disabled) + button('Record referee baseline', 'resolve-aslan-estate', '', 'data-method="referee-baseline"' + disabled) + help;
  }
  if (state.stage === 'aslan-clan') return start + button('Roll clan and scope', 'roll-aslan-clan') + '<details><summary>Referee-selected clan</summary><label>Clan name<input id="aslan-clan-name" maxlength="80"' + disabled + '></label><label>Scope<input id="aslan-clan-scope" maxlength="160"' + disabled + '></label>' + reasonField(disabled) + button('Record selected clan', 'choose-aslan-clan', 'quiet', disabled) + help + '</details>';
  if (state.stage === 'aslan-pride') return start + '<p>Clan: <strong>' + esc(origin.clan?.name || origin.clan?.type) + '</strong>.</p><details><summary>Give the clan a name</summary><label>Clan name<input id="aslan-clan-name" maxlength="80" value="' + esc(origin.clan?.name ?? '') + '"></label>' + button('Record clan name', 'name-aslan-clan', 'quiet') + '</details>' + button('Roll pride', 'roll-aslan-pride');
  if (state.stage === 'aslan-rite') return start + '<p>Background skills are recorded. The rite and its RITE modifier stay in the action log.</p>' + button('Roll the rite', 'roll-aslan-rite');
  return '<p class="warning">The Aslan origin step is not recognized. Preserve your save and log.</p>';
}
export function aslanOriginSourceView(state, {esc, button, sourceLabel}) {
  const origin = state.currentAslanOrigin;
  if (!origin || state.pending?.kind !== 'aslan-origin-source') return '<p class="warning">The Aslan origin ruling is unavailable. Preserve your save and log.</p>';
  const disabled = state.config.gm ? '' : ' disabled';
  let input;
  const decision = origin.sourceDecision?.kind ?? state.pending.decision;
  if (decision === 'family-band') {
    const choices = origin.sourceDecision?.options ?? origin.familyBandOptions ?? [];
    if (!choices.length) return '<p class="warning">No family classifications are available. Preserve your save and log.</p>';
    input = '<label>Referee family classification<select id="aslan-family-band"' + disabled + '><option value="">Choose a classification</option>' + choices.map(choice => '<option value="' + esc(choice.id) + '">' + esc(choice.name) + '</option>').join('') + '</select></label>';
  } else if (decision === 'female-independence') {
    input = '<p class="warning">The family result awards Independence, but the skill rule is male-only. Granting it is a GM exception.</p><label>Ruling<select id="aslan-origin-decision"' + disabled + '><option value="">Choose a ruling</option><option value="omit">Omit this award</option><option value="grant-level-zero">Grant level 0 (exception)</option></select></label>';
  } else if (decision === 'gender') {
    const choices = origin.sourceDecision?.options ?? [];
    if (!choices.length) return '<p class="warning">The source rules branches are unavailable. Preserve your save and log.</p>';
    input = '<p>Your chosen gender stays unchanged. Select the published rules branch for this character.</p><label>Source rules branch<select id="aslan-origin-gender"' + disabled + '><option value="">Choose a rules branch</option>' + choices.map(choice => '<option value="' + esc(choice.id) + '">' + esc(choice.name) + '</option>').join('') + '</select></label>';
  } else return '<p class="warning">The origin ruling is not recognized. Preserve your save and log.</p>';
  return '<p class="source">' + esc(sourceLabel('aliens', state.pending.page ?? 17)) + '</p>' + familyEvidence(origin, esc) + input + reasonField(disabled) + button('Record origin ruling', 'resolve-aslan-origin-source', '', disabled) + (!state.config.gm ? '<p class="help">Enable GM changes to record this source ruling.</p>' : '');
}
export function aslanOriginSheet(state, {esc}) {
  const origin = state.character.aslanOrigin;
  if (!origin) return '';
  const family = origin.family, estate = origin.estate, clan = origin.clan, pride = origin.pride;
  return '<div class="sheet-section"><h3>Aslan family and origin</h3><p>Family SOC at creation: <strong>' + esc(origin.familySOC) + '</strong>.</p>' +
    (origin.gender?.mode === 'referee' ? '<p>Source rules branch: ' + esc(origin.gender.value) + '. Chosen gender: ' + esc(origin.identityGender) + '.</p>' : '') +
    (family ? '<p>Family background: ' + esc(family.label ?? family.band) + '.</p>' : '') +
    (origin.birthOrder ? '<p>Family position: ' + esc(({ 'first-son': 'First son', 'second-son': 'Later son', daughter: 'Daughter' })[origin.birthOrder.id] ?? origin.birthOrder.id) + '.</p>' : '') +
    (estate ? '<p>' + (estate.minimumParcels === null ? 'No printed family estate. ' : 'Family land minimum: ' + esc(estate.minimumParcels) + ' parcels. ') + 'Personal ownership: unestablished.' + (estate.inheritance === 'first-son' ? ' First-son inheritance position recorded.' : '') + '</p>' : '') +
    (clan ? '<p>Clan: ' + esc(clan.name || clan.type) + '.' + (clan.scope ? ' Scope: ' + esc(clan.scope.description ?? (clan.scope.count + ' ' + clan.scope.unit + (clan.scope.count > 1 ? 's' : ''))) + '.' : '') + '</p>' : '') +
    (pride ? '<p>Pride: ' + esc(pride.name ?? pride.id) + '.</p>' : '') +
    (origin.rite ? '<p>Rite roll: ' + esc(origin.rite.total) + '. RITE modifier: ' + esc(origin.rite.modifier) + '.</p>' : '') + '</div>';
}
