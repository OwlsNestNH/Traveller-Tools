import test from 'node:test';
import assert from 'node:assert/strict';
import {formatSnapshotTons,formatSnapshotWholeDown,formatSnapshotLss,formatSnapshotQuantityText} from '../js/player-snapshot-format.mjs';
test('tonnage labels ceil exact decimals without floating-point loss or rounding stock',()=>{
 for(const [value,label] of [[null,'Unknown'],['0','0'],['0.000000','0'],['0.000001','1'],['31.5','32'],['32','32'],['32.000000','32'],['40.01','41'],['999999999999999.000001','1,000,000,000,000,000']])assert.equal(formatSnapshotTons(value),label);
});
test('explicit tonnage in expense prose rounds while credit rates stay exact and LSS stock floors',()=>{
 assert.equal(formatSnapshotQuantityText('Supplies at 1.5 LSS/day or 1.5 LSS per day'),'Supplies at 1.5 LSS/day or 1.5 LSS per day');
 assert.equal(formatSnapshotQuantityText('Planned 3.5 t refined top-up at Cr500.25/t'),'Planned 4 t refined top-up at Cr500.25/t');
 assert.equal(formatSnapshotQuantityText('1,234.1 tons; 0.0 tonnes; 31.5t; 150.5 LSS; Cr0.5/ton'),'1,235 tons; 0 tonnes; 32t; 150 LSS; Cr0.5/ton');
});

test('LSS labels floor stock independently of tonnage and preserve unknown',()=>{
 for(const [value,label] of [[null,'Unknown'],['0','0'],['0.999999','0'],['150.999999','150'],['150.000000','150'],['999999999999999.999999','999,999,999,999,999']])assert.equal(formatSnapshotLss(value),label);
});

test('fuel quantities and capacities floor independently of cargo space',()=>{
 assert.equal(formatSnapshotWholeDown('31.5'),'31');assert.equal(formatSnapshotWholeDown('40.25'),'40');assert.equal(formatSnapshotWholeDown('0.999999'),'0');assert.equal(formatSnapshotWholeDown('32.000000'),'32');assert.equal(formatSnapshotWholeDown(null),'Unknown');
 assert.equal(formatSnapshotTons('1.5'),'2');assert.equal(formatSnapshotQuantityText('Planned 3.5 t refined top-up at Cr500/t',{fuel:true}),'Planned 3 t refined top-up at Cr500/t');
});
