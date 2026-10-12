// Preserve historical economic/save observations while excluding only the
// approved .67 presentation additions. Real candidate DOM/layout is verified
// separately in route-editor-current-world-browser.test.mjs.
export function legacyRouteEditorMarkup(html){
 if(!html.includes('class="panel-body world-correction"'))return html;
 html=html.replace(/<div class="panel-body world-correction">[\s\S]*?<\/div>/,'');
 const editor=html.match(/<section class="panel-body route-draft"[\s\S]*?<\/section>/)?.[0];
 if(editor){
  html=html.replace(editor,'');
  html=html.replace('<div class="planned-route"',editor.replace(' <span class="tag">Planning active</span>','')+'<div class="planned-route"');
 }
 return html;
}
