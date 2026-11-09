import {assignmentSetup} from './assignment-fixtures.mjs';
import {run} from './core-life-event-fixtures.mjs';
const cache=new Map();
export function qualificationOutcomeFixture(success){
 if(cache.has(success))return structuredClone(cache.get(success));
 for(let seed=0;seed<50;seed++){
  const before=run(assignmentSetup('result-qualification-'+seed),'skip-precareer');
  const after=run(before,'career',{id:'core.navy',assignment:'crew'});
  if(after.log.at(-1).summary.includes('"success":'+success)){
   const result={before,after};cache.set(success,result);return structuredClone(result);
  }
 }
 throw Error('No qualification outcome fixture found.');
}
