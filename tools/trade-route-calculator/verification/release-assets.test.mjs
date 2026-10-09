import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
test('release stylesheet, app, and every changed shared module use the same cache token',async()=>{
 const root=new URL('../',import.meta.url),html=await readFile(new URL('index.html',root),'utf8');
 const token=html.match(/href="style\.css\?v=([^"]+)"/)?.[1];assert.ok(token,'Stylesheet has a release token');
 assert.equal(html.match(/src="js\/app\.mjs\?v=([^"]+)"/)?.[1],token);
 const changed=new Set(['state','expenses','persistence','report','service-panels','expense-panels','settings-layout','mortgage','maintenance','payment-schedule']);
 for(const file of await readdir(new URL('js/',root))){if(!file.endsWith('.mjs'))continue;const source=await readFile(new URL('js/'+file,root),'utf8');for(const [,name,query]of source.matchAll(/from '\.\/([^']+)\.mjs(?:\?v=([^']+))?'/g))if(changed.has(name))assert.equal(query,token,file+' imports current '+name);}
});
