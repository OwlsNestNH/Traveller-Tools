import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
for(const relative of ['index.html','styles.css','server.mjs',...(await readdir(new URL('engine/',root))).filter(x=>x.endsWith('.mjs')).map(x=>'engine/'+x),...(await readdir(new URL('gui/',root))).filter(x=>x.endsWith('.mjs')).map(x=>'gui/'+x)]) {
 test(relative+' is valid UTF-8 without damaged display characters',async()=>{
  const bytes=await readFile(new URL(relative,root));
  const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  assert.equal(text.includes('\ufffd'),false,'Unicode replacement character found');
  assert.equal(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text),false,'Non-text control character found');
 });
}
