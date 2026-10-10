import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAmount,normalizeAmountFields} from '../js/form-values.mjs';

test('amount normalization retains exact upward whole-Credit and Cr100 behavior',()=>{
 for(const [raw,step,value] of [['10.1',1,'11'],['-10.1',1,'-10'],['0',1,'0'],['100',100,'100'],['10.1',100,'100'],['-149',100,'-100'],['100.01',100,'200'],['900719925474099312345678901234.01',1,'900719925474099312345678901235']])assert.deepEqual(normalizeAmount(raw,{unit:'credits',creditStep:step}),{value,rounding:raw===value?null:{before:raw,after:value}});
});

test('whole-ton normalization is independent of the Credit increment',()=>{
 for(const step of [1,100])for(const [raw,value] of [['0.01','1'],['1.01','2'],['2','2'],['-1.5','-1']])assert.deepEqual(normalizeAmount(raw,{unit:'tons',creditStep:step}),{value,rounding:raw===value?null:{before:raw,after:value}});
});

test('exact legacy half-ton and one-and-a-half-ton remainders bypass rounding only at equality',()=>{
 for(const remaining of ['0.5','1.5']){
  assert.deepEqual(normalizeAmount(remaining,{unit:'tons',exactRemainder:remaining}),{value:remaining,rounding:null});
  assert.deepEqual(normalizeAmount(remaining+'0',{unit:'tons',exactRemainder:remaining}),{value:remaining+'0',rounding:null});
 }
 assert.deepEqual(normalizeAmount('0.5',{unit:'tons',exactRemainder:'1.5'}),{value:'1',rounding:{before:'0.5',after:'1'}});
 assert.deepEqual(normalizeAmount('1.49',{unit:'tons',exactRemainder:'1.5'}),{value:'2',rounding:{before:'1.49',after:'2'}});
});

test('equal amounts retain original spelling and changed audits retain original entry text',()=>{
 for(const raw of ['010.00',' -0.00 ','100.000'])assert.deepEqual(normalizeAmount(raw,{unit:'credits'}),{value:raw,rounding:null});
 assert.deepEqual(normalizeAmount(' 010.10 ',{unit:'credits'}),{value:'11',rounding:{before:' 010.10 ',after:'11'}});
});

test('malformed amounts and invalid exact-remainder metadata remain validation errors',()=>{
 for(const raw of ['NaN','Infinity','1e3','1,000','<img>','1/2',null,undefined,'9'.repeat(101)])assert.throws(()=>normalizeAmount(raw,{unit:'credits'}),/finite decimal/);
 assert.throws(()=>normalizeAmount('0.5',{unit:'tons',exactRemainder:'bad'}),/finite decimal/);
});

const field=(value,round='credits',label='Amount',extra={})=>({value,disabled:false,dataset:{round,roundLabel:label},...extra});

test('field adapter skips blank and disabled entries before parsing their values or exact metadata',()=>{
 const disabled=field('bad','credits','Disabled',{disabled:true,dataset:{round:'credits',roundExact:'bad'}});
 const blank=field('','credits','Blank',{dataset:{round:'credits',roundExact:'bad'}});
 const fields=[disabled,blank,field('10.1')],rounding=[];
 assert.equal(normalizeAmountFields(fields,{creditStep:100,rounding}),rounding);
 assert.deepEqual(fields.map(x=>x.value),['bad','','100']);
 assert.deepEqual(rounding,[{label:'Amount',before:'10.1',after:'100'}]);
});

test('field adapter appends to the existing audit array in order without duplicate repeat annotations',()=>{
 const prior={label:'Earlier entry',before:'0.1',after:'1'},rounding=[prior];
 const fields=[field('10.1','credits','Credits <&>'),field('0.5','tons','Remainder',{dataset:{round:'tons',roundLabel:'Remainder',roundExact:'0.50'}}),field('1.01','tons','Tons')];
 assert.equal(normalizeAmountFields(fields,{creditStep:100,rounding}),rounding);
 assert.equal(rounding[0],prior);
 assert.deepEqual(rounding,[prior,{label:'Credits <&>',before:'10.1',after:'100'},{label:'Tons',before:'1.01',after:'2'}]);
 const first=structuredClone(rounding);
 normalizeAmountFields(fields,{creditStep:100,rounding});
 assert.deepEqual(rounding,first);assert.deepEqual(fields.map(x=>x.value),['100','0.5','2']);
});

test('late invalid fields preserve earlier normalization and annotations for a corrected retry',()=>{
 const fields=[field('10.1'),field('invalid'),field('1.1','tons')],rounding=[];
 assert.throws(()=>normalizeAmountFields(fields,{rounding}),/finite decimal/);
 assert.deepEqual(fields.map(x=>x.value),['11','invalid','1.1']);
 assert.deepEqual(rounding,[{label:'Amount',before:'10.1',after:'11'}]);
 fields[1].value='20.1';normalizeAmountFields(fields,{rounding});
 assert.deepEqual(fields.map(x=>x.value),['11','21','2']);
 assert.deepEqual(rounding.map(x=>x.before),['10.1','20.1','1.1']);
});

test('non-Credit field metadata retains the existing whole-unit fallback',()=>{
 for(const unit of ['tons','legacy',undefined])assert.deepEqual(normalizeAmount('1.1',{unit,creditStep:100}),{value:'2',rounding:{before:'1.1',after:'2'}});
});
