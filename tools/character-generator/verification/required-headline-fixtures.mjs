// Pick real saved-session seeds for review; never override production copy selection.
import {createSession,project} from '../engine/session.mjs';
import {requiredActionKey,requiredHeadline,REQUIRED_HEADLINES} from '../gui/required-action.mjs';
export function headlineFixture(type,headline){
 for(let n=0;n<500;n++){
  const session=createSession('crow-headline-review-'+n),state=project(session).state,key=requiredActionKey(state,{id:'setup-gender'});
  if(requiredHeadline(type,key)===headline)return {session,key};
 }
 throw new Error('No deterministic headline fixture for '+headline);
}
export const firstPageWarningFixture=()=>headlineFixture('starting',REQUIRED_HEADLINES.starting[0]);
