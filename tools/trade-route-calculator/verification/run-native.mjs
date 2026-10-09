import {readdir, readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Discover every native suite, including future additions. Browser scripts share
// the historical *.test.mjs naming convention but require their own runner.
// Fail on an unclassified test instead of silently leaving it out of the gate.
const directory = fileURLToPath(new URL('.', import.meta.url));
const suites = [];
for (const name of (await readdir(directory)).filter(name => name.endsWith('.test.mjs')).sort()) {
  const source = await readFile(new URL(name, import.meta.url), 'utf8');
  if (/from\s+['"]node:test['"]/.test(source)) suites.push(fileURLToPath(new URL(name, import.meta.url)));
  else if (!source.includes("'playwright'")) throw Error(`Unclassified test suite: ${name}`);
}
if (!suites.length) throw Error('No native test suites found');
console.log(`Running all ${suites.length} native suites; browser scripts run separately in CI.`);
const result = spawnSync(process.execPath, ['--test', ...suites], {stdio:'inherit'});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
