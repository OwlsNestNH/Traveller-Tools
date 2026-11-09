// Mechanical encoding only. Core Rulebook Update 2022, p. 46.
export const CORE_LIFE_SOURCE={id:'core',page:46};
const decision=(decision,label)=>({kind:'core-life-decision',decision,label});
const relationship=type=>({kind:'relationship',type});
export const CORE_LIFE_TABLES={
 'core.life-events':{dice:'2D',results:{
  2:[{kind:'injury',table:'core.injury',source:{id:'core',page:49}}],
  3:[decision('narrative','Record a birth or death involving someone close.')],
  4:[decision('ending','Choose the Rival or Enemy from the ended relationship.')],
  5:[relationship('Ally')],6:[relationship('Ally')],7:[relationship('Contact')],
  8:[decision('betrayal','Convert one Contact or Ally to a Rival or Enemy, or gain one if neither exists.')],
  9:[{kind:'modifier',target:'qualification',value:2,scope:'next',career:'any'}],
  10:[{kind:'core-life-benefit-bonus'}],
  11:[decision('crime','Lose one Benefit roll or enter Prisoner next term.')],
  12:[{kind:'table-roll',table:'core.unusual-events',dice:'1D'}]
 }},
 'core.unusual-events':{dice:'1D',results:{
  1:[decision('psionics','Choose whether to test at the encountered institute; access does not grant free training.')],
  2:[{kind:'skill',name:'Science',mode:'set',value:1},{...relationship('Contact'),name:'Alien contact'}],
  3:[decision('artefact','Record the alien artefact agreed with the referee.')],
  4:[decision('narrative','Record the unexplained gap in memory.')],
  5:[decision('narrative','Record the encounter with Imperial government.')],
  6:[decision('artefact','Record the ancient technology agreed with the referee.')]
 }}
};
export function lifeNarrativeOptions(record){return record.table==='core.life-events'?['birth','death']:record.row===4?['amnesia']:['government'];}
export function lifePsionAccess(state){const r=state.character.lifePsionAccess;return !!r&&(state.character.stats.PSI??0)>0&&!state.character.psionicLoss&&state.character.terms===r.availableAtTerms&&state.character.careers.length===r.careerCount;}
