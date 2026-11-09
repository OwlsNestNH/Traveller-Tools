import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInThisContext} from 'node:vm';

const app=readFileSync(new URL('../js/app.mjs',import.meta.url),'utf8');
const visibility=app.slice(app.indexOf('function matchesVisibility('),app.indexOf('\nfunction controlVisible('));
const dependency=app.slice(app.indexOf('function dependsOn('),app.indexOf('\nfunction renderControl('));
const {matchesVisibility,dependsOn}=runInThisContext(`(()=>{${visibility}\n${dependency}\nreturn {matchesVisibility,dependsOn};})()`);

test('visibility supports nested alternatives without discarding conjunctions',()=>{
 const control={visibleWhen:{anyOf:[{field:'retained',equals:true},{allOf:[{field:'weapon',oneOf:['eligible']},{field:'autoload',equals:false},{field:'count',notEquals:0}]}]}};
 assert.equal(matchesVisibility(control,{retained:false,weapon:'eligible',autoload:false,count:1}),true);
 assert.equal(matchesVisibility(control,{retained:false,weapon:'eligible',autoload:false,count:0}),false);
 assert.equal(matchesVisibility(control,{retained:false,weapon:'eligible',autoload:true,count:1}),false);
 assert.equal(matchesVisibility(control,{retained:false,weapon:'unsupported',autoload:false,count:1}),false);
 assert.equal(matchesVisibility(control,{retained:true,weapon:'unsupported',autoload:true,count:0}),true);
 assert.equal(matchesVisibility({visibleWhen:{anyOf:[]}},{retained:true}),false);
 assert.equal(matchesVisibility({},{}),true);
});

test('composer redraw dependencies traverse nested alternatives and conjunctions',()=>{
 const rule={anyOf:[{field:'retained',equals:true},{allOf:[{field:'weapon',equals:'eligible'},{anyOf:[{field:'autoload',equals:false},{field:'count',equals:1}]}]}]};
 for(const field of ['retained','weapon','autoload','count'])assert.equal(Boolean(dependsOn(rule,field)),true);
 assert.equal(Boolean(dependsOn(rule,'unrelated')),false);
 assert.equal(Boolean(dependsOn(undefined,'weapon')),false);
});
