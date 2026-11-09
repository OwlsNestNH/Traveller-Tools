import test from 'node:test';
import assert from 'node:assert/strict';
import {clanAssetTotals,clanAssetPayload,clanWeaponRow,clanAssetFields,clanAssetSheetDetail} from '../gui/clan-asset-view.mjs';
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const context={esc,button:(name,action,cls='',attrs='')=>'<button data-action="'+action+'" '+attrs+'>'+name+'</button>'};
const rules={valuePerShare:10000,nameMaxLength:120,maxItems:20,minItemQuantity:1,maxItemQuantity:100,minUnitCost:1,maxUnitCost:1000000000,minTL:0,maxTL:40,sourceReferenceMaxLength:160,reasonMaxLength:500};
test('asset totals distinguish exact, lower, over and incomplete prices',()=>{
 assert.deepEqual(clanAssetTotals(2,rules,[{quantity:20,unitCost:1000}]),{budget:20000,total:20000,unused:0});
 assert.equal(clanAssetTotals(1,rules,[{quantity:2,unitCost:500}]).unused,9000);
 assert.equal(clanAssetTotals(1,rules,[{quantity:3,unitCost:5000}]).unused,-5000);
 assert.equal(clanAssetTotals(1,rules,[{quantity:undefined,unitCost:500}]).total,null);
 assert.equal(clanAssetTotals(1.5,rules,[]).budget,null);
});
test('art payload never transmits hidden weapons or lower-value fields',()=>{
 assert.deepEqual(clanAssetPayload('art',{name:'Statue',items:[{}],sourceConfirmed:true,lowerValueConfirmed:true}),{name:'Statue'});
 assert.deepEqual(clanAssetPayload('cash',{}),{});
});
test('weapon payload preserves explicit confirmation and adds no inferred ruling',()=>{
 const fields={items:[{name:'Sword',quantity:1,unitCost:10000,tl:2,sourceReference:'Book p1'}],sourceConfirmed:false,sourceReason:'',lowerValueConfirmed:false};
 assert.deepEqual(clanAssetPayload('weapons',fields),{items:fields.items,sourceConfirmed:false,sourceReason:''});
 assert.deepEqual(clanAssetPayload('weapons',{...fields,lowerValueConfirmed:true,lowerValueReason:'Explicit exception'}).lowerValueAcceptance,{confirmed:true,reason:'Explicit exception'});
});
test('asset forms use projected bounds and start unconfirmed, no automatic catalog claim',()=>{
 const html=clanAssetFields({clanShareOptions:{assetRules:rules}},context);
 assert.match(html,/maxlength="160"/);assert.match(html,/max="1000000000"/);assert.match(html,/max="40"/);
 assert.match(html,/No equipment catalog is checked automatically/);assert.match(html,/unused value is surrendered, with no cash or credit/);
 assert.doesNotMatch(html,/<input[^>]*\schecked(?:\s|>|=)/);assert.match(html,/id="clan-art-fields" hidden/);assert.match(html,/id="clan-weapon-fields" hidden/);
 assert.equal(clanAssetFields({clanShareOptions:{assetRules:null}},context),'');
});
test('weapon row values and asset descriptions are escaped and identities retained',()=>{
 const html=clanWeaponRow(2,rules,context,{name:'<Weapon>',sourceReference:'Book "p1"',quantity:3});
 assert.match(html,/Weapon 3/);assert.match(html,/data-index="2"/);assert.match(html,/&lt;Weapon&gt;/);assert.match(html,/&quot;p1&quot;/);assert.doesNotMatch(html,/<Weapon>/);
});
test('sheet distinguishes assessed art or verified weapons from liquid cash',()=>{
 const art=clanAssetSheetDetail({redemptionId:'r1',category:'art',quantity:1,assessedValue:10000,sourceVerification:{method:'source-derived'}},context);
 assert.match(art,/Share-derived value/);assert.match(art,/Not cash or a guaranteed resale price/);
 const weapon=clanAssetSheetDetail({redemptionId:'r2',category:'weapon',quantity:20,assessedValue:10000,tl:2,sourceReference:'<Book>',sourceVerification:{method:'referee-confirmed'}},context);
 assert.match(weapon,/20 items/);assert.match(weapon,/Referee-confirmed item prices/);assert.match(weapon,/&lt;Book&gt;/);
 assert.equal(clanAssetSheetDetail({category:'weapon'},context),'');
});
