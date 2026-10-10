import test from 'node:test';
import assert from 'node:assert/strict';
import {escapeHtml,formatCreditsText,formatDecimalCreditsText,moneyHtml} from '../js/display.mjs';

test('HTML escaping treats null as empty and saved text as text exactly once',()=>{
 for(const [raw,want] of [[null,''],[undefined,''],[0,'0'],['A&B <port> "name" \'note\'','A&amp;B &lt;port&gt; &quot;name&quot; &#39;note&#39;'],['&amp;','&amp;amp;'],['Regina / 世界','Regina / 世界']])assert.equal(escapeHtml(raw),want);
 assert.equal(escapeHtml({toString:()=>'<img src=x onerror="bad()">'}),'&lt;img src=x onerror=&quot;bad()&quot;&gt;');
});

test('plain Credit text keeps exact large digits, signs and existing decimal grouping',()=>{
 for(const [raw,want] of [['0','Cr 0'],['-1234567','Cr -1,234,567'],['900719925474099312345678901234','Cr 900,719,925,474,099,312,345,678,901,234'],[900719925474099312345678901234n,'Cr 900,719,925,474,099,312,345,678,901,234'],['1234.5678','Cr 1,234.5,678'],['001234','Cr 001,234'],[null,'Cr null'],[undefined,'Cr undefined']]){
  assert.equal(formatCreditsText(raw),want);
 }
});

test('plain Credit formatting leaves escaping to each HTML sink',()=>{
 const raw='<img src="x"> & \'1234\'';
 assert.equal(formatCreditsText(raw),'Cr <img src="x"> & \'1,234\'');
 assert.equal(escapeHtml(formatCreditsText(raw)),'Cr &lt;img src=&quot;x&quot;&gt; &amp; &#39;1,234&#39;');
 assert.equal(moneyHtml(raw),escapeHtml(formatCreditsText(raw)));
 assert.equal(moneyHtml('&amp;1234'),'Cr &amp;amp;1,234');
});

test('the application HTML wrapper preserves Not recorded for missing historical money',()=>{
 assert.equal(moneyHtml(null),'Not recorded');assert.equal(moneyHtml(undefined),'Not recorded');
 assert.equal(moneyHtml(''),'Cr ');assert.equal(moneyHtml('0'),'Cr 0');
 assert.equal(moneyHtml('1234.5678'),'Cr 1,234.5,678');
});

test('service Credit text preserves its separate whole-part grouping contract',()=>{
 for(const [raw,want] of [['1234.5678','Cr 1,234.5678'],['1234.','Cr 1,234'],['1234.00','Cr 1,234.00'],['1234.50.60','Cr 1,234.50'],['-9007199254740993.0001','Cr -9,007,199,254,740,993.0001'],[null,'Cr null'],[undefined,'Cr undefined'],['<&>','Cr <&>']])assert.equal(formatDecimalCreditsText(raw),want);
});
