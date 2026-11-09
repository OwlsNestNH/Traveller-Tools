export const prisonerEscapeTitle='Prisoner Event 3: Escape opportunity';
export function prisonerEscapeView(opportunity,{esc,button}){
 if(!opportunity)return '';
 return '<p>You have found a possible way out of prison. Choose which skill to use if you want to try escaping.</p><p>Success lets you leave prison. Failure raises your Parole Threshold by 2 (maximum 12). Staying makes no escape roll and does not change your Parole Threshold.</p><p class="tiny">Core Rulebook Update 2022, p. 57.</p><div class="choice-list">'+opportunity.skills.map(skill=>button('Attempt escape using '+esc(skill.name)+' (10+)','prisoner-escape','choice','data-skill="'+esc(skill.name)+'"')+'<p class="help">'+esc(skill.name)+' '+esc(skill.level<0?'untrained':skill.level)+' · Check DM '+esc(skill.modifier>=0?'+'+skill.modifier:skill.modifier)+'.</p>').join('')+button('Stay in prison','choose-effect','choice','data-index="1"')+'</div>';
}
