// Read-only authorization boundary for dice nested within an accepted career event.
export function validNativeEventContext(state){
 const c=state.nativeEventContext;
 if(!state.nativeEventRollCheckpoints||!c||c.careerIndex!==state.active)return null;
 const r=state.character.careers[state.active];
 if(!r||r.id!==c.careerId||r.terms!==c.careerTerms)return null;return c;
}
export function nativeEventRollPending(state,e){
 const c=validNativeEventContext(state);if(!c||!e)return null;
 const kinds=['check','random','table-roll','source-training-roll','borrowed-injury-table','borrowed-injury-severity'];
 if(!kinds.includes(e.kind)&&!(['cash','stat','relationship','benefit-rolls'].includes(e.kind)&&e.dice))return null;
 // Missing characteristics retain the established source-resolution path.
 if(e.kind==='check'&&e.stat&&(!Object.hasOwn(state.character.stats,e.stat)||state._sourceCheck))return null;
 const label=e.kind==='check'?(e.stat??e.skills?.join(' or ')??'Skill')+' check':e.kind==='table-roll'?(e.table?.replaceAll('-',' ')??'Event table'):e.kind==='random'?'Event consequence':e.kind==='source-training-roll'?'Source training':e.kind==='cash'?'Cash award':e.kind==='relationship'?(e.type??'Relationship')+' count':e.kind==='stat'?(e.name??'Characteristic')+' change':e.kind==='benefit-rolls'?'Benefit rolls':'Injury roll';
 return {id:'career-'+c.careerIndex+'-'+c.careerTerms+'-'+c.kind+'-'+c.row+'-roll-'+((state.effectSteps??0)+1),nativeCareerIndex:c.careerIndex,label,kind:e.kind,dice:e.dice??(e.kind==='check'?'2D':['source-training-roll','borrowed-injury-table','borrowed-injury-severity'].includes(e.kind)?'1D':['mishap','mishaps','core.mishap'].includes(e.table)?'1D':'2D'),source:structuredClone(['borrowed-injury-table','borrowed-injury-severity'].includes(e.kind)?{id:'core',page:49}:e.source??c.source),target:e.kind==='check'?e.target:null,resumeStage:state.stage};
}
