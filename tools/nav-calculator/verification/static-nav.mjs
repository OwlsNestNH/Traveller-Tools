import {readFile} from 'node:fs/promises';
// setContent has no base URL. Inline the exact deployed scripts for isolated tests;
// layout.test.mjs separately verifies real relative resource loading over HTTP.
export async function loadStaticNav(page){
  let html = await readFile(new URL('../index.html',import.meta.url),'utf8');
  for(const name of ['engine.js','app.js']){
    const source = await readFile(new URL('../'+name,import.meta.url),'utf8');
    html = html.replace('<script src="'+name+'"></script>',()=>'<script>'+source+'</script>');
  }
  await page.setContent(html);
}
