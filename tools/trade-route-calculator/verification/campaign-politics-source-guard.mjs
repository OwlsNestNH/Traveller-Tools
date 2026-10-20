// The reviewed territory addition to state.mjs is exactly this import and
// optional-field validation call. Remove only those literals so historical
// economic source hashes still check every byte of the economic algorithms.
export function withoutCampaignPoliticsValidation(source){
 return source.replace("import {projectCampaignPolitics} from './campaign-politics.mjs';\n",'')
  .replace('export function validate(s){if(s?.campaignPolitics!=null)projectCampaignPolitics(s.campaignPolitics);','export function validate(s){');
}
