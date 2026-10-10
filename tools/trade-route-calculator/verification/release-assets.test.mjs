import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
test('release stylesheet, app, and every changed shared module use the same cache token',async()=>{
 const root=new URL('../',import.meta.url),html=await readFile(new URL('index.html',root),'utf8');
 const token=html.match(/href="style\.css\?v=([^"]+)"/)?.[1];assert.ok(token,'Stylesheet has a release token');
 const report=await readFile(new URL('js/report.mjs',root),'utf8');
 assert.equal(report.match(/REPORT_VERSION='([^']+)'/)?.[1],html.match(/UI (\d{4}\.\d{2}\.\d{2}\.\d+)/)?.[1],'Report metadata matches displayed release');
 assert.equal(html.match(/src="js\/app\.mjs\?v=([^"]+)"/)?.[1],token);
 assert.equal(html.match(/href="rule-references\.css\?v=([^"]+)"/)?.[1],token);
 const changed=new Set(['map-overview','campaign-controller','fuel','rules','map','world-picker','global-world-search','state','expenses','persistence','report','service-panels','expense-panels','settings-layout','mortgage','maintenance','payment-schedule','cargo-hold','world-symbols','accommodation','life-support','rounding','passengers','passenger-rules','passenger-ui','contact-search','display','form-values','rule-references','rule-popover','world-change-history']);
 for(const file of await readdir(new URL('js/',root))){if(!file.endsWith('.mjs'))continue;const source=await readFile(new URL('js/'+file,root),'utf8');for(const [,name,query]of source.matchAll(/from '\.\/([^']+)\.mjs(?:\?v=([^']+))?'/g))if(changed.has(name))assert.equal(query,token,file+' imports current '+name);}
});

test('the complete static module graph exists and resolves inside the Pages project subdirectory',async()=>{
 const root=new URL('../',import.meta.url),files=(await readdir(new URL('js/',root))).filter(file=>file.endsWith('.mjs'));
 const publicRoot=new URL('https://example.invalid/Traveller-Tools/tools/trade-route-calculator/');
 for(const file of files){
  const source=await readFile(new URL('js/'+file,root),'utf8');
  for(const [,specifier]of source.matchAll(/^import .* from ['"]([^'"]+)['"]/gm)){
   assert.ok(specifier.startsWith('./'),file+' has a relative static dependency');
   const local=new URL(specifier,new URL('js/'+file,root)),published=new URL(specifier,new URL('js/'+file,publicRoot));
   assert.ok(published.href.startsWith(publicRoot.href),file+' stays in the Pages project path');
   assert.ok(files.includes(local.pathname.split('/').at(-1)),file+' dependency is included in the release');
   assert.ok((await readFile(local,'utf8')).length,file+' dependency has source');
  }
 }
});
