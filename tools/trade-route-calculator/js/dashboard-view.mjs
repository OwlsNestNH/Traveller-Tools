import {dashboardData} from './dashboard-data.mjs?v=replacement-completion-20261010-44';
import {escapeHtml as esc,moneyHtml} from './display.mjs?v=replacement-completion-20261010-44';

// Read-only presentation. Exact Credits remain BigInts until bounded ratios are
// converted to SVG coordinates; display values always use the shared formatter.
const credit=value=>BigInt(value),abs=value=>value<0n?-value:value;
const sum=rows=>rows.reduce((total,row)=>total+credit(row.amount),0n);
const ratio=(value,total)=>total===0n?0:Number(value*1000000n/total)/1000000;
const colors=['#62d3dd','#f5bd6c','#a7adff','#8addaf','#ff959e','#92bee9','#d9b7ed','#c5d68d'];
const compact=value=>{
 const n=abs(value),sign=value<0n?'−':'',digits=String(n);
 if(n<1000n)return sign+digits;
 const groups=[['T',1000000000000n],['B',1000000000n],['M',1000000n],['k',1000n]];
 if(n<1000000000000000n){const [unit,scale]=groups.find(([,scale])=>n>=scale);return sign+String(n/scale)+'.'+String(n%scale*10n/scale)+unit;}
 return sign+digits[0]+'.'+digits[1]+'e'+(digits.length-1);
};
const empty=text=>'<div class="dashboard-empty">'+esc(text)+'</div>';
const metric=(label,value)=>'<div class="dashboard-metric"><span>'+esc(label)+'</span><strong>'+moneyHtml(value)+'</strong></div>';
const card=(id,title,body)=>'<section class="dashboard-card" aria-labelledby="dashboard-'+id+'-heading"><div class="dashboard-card-head"><h3 id="dashboard-'+id+'-heading">'+esc(title)+'</h3></div>'+body+'</section>';
function table(label,headers,rows){
 return '<div class="dashboard-table-scroll" tabindex="0" role="region" aria-label="'+esc(label)+'"><table><caption>'+esc(label)+'</caption><thead><tr>'+headers.map((header,i)=>'<th scope="col"'+(i?' class="number"':'')+'>'+esc(header)+'</th>').join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></div>';
}
function details(label,headers,rows){return '<details class="dashboard-data"><summary>'+esc(label)+'</summary>'+table(label,headers,rows)+'</details>';}
function extent(values){
 let low=0n,high=0n;for(const value of values){if(value<low)low=value;if(value>high)high=value;}
 if(low===high)high=low+1n;
 return {low,high,y:value=>208-ratio(value-low,high-low)*176};
}
function axes(scale){
 return [scale.low,(scale.low+scale.high)/2n,scale.high].map((value,i,values)=>{
  if(values.indexOf(value)!==i)return '';
  const y=scale.y(value);
  return '<line class="dashboard-gridline" x1="70" x2="538" y1="'+y+'" y2="'+y+'"/><text class="dashboard-axis" x="61" y="'+(y+4)+'" text-anchor="end">'+esc(compact(value))+'</text>';
 }).join('')+'<text class="dashboard-axis" x="70" y="17">Credits · abbreviated scale</text>';
}
function svg(label,content){return '<svg class="dashboard-chart" viewBox="0 0 560 250" role="img" aria-label="'+esc(label)+'"><title>'+esc(label)+'</title>'+content+'</svg>';}
// Preserve extrema within chronological buckets, plus both endpoints. Only the
// graphic is sampled; the full saved series is retained in its exact-value table.
function sampleCash(points){
 if(points.length<=180)return points.map((point,index)=>({point,index}));
 const chosen=[{point:points[0],index:0}],size=Math.ceil((points.length-2)/80);
 for(let start=1;start<points.length-1;start+=size){
  const end=Math.min(start+size,points.length-1);let min=start,max=start;
  for(let index=start+1;index<end;index++){if(credit(points[index].balance)<credit(points[min].balance))min=index;if(credit(points[index].balance)>credit(points[max].balance))max=index;}
  for(const index of [...new Set([min,max])].sort((a,b)=>a-b))chosen.push({point:points[index],index});
 }
 chosen.push({point:points.at(-1),index:points.length-1});return chosen;
}
function cashCard(data){
 const points=data.cashPoints,scale=extent(points.map(point=>credit(point.balance))),selected=sampleCash(points);
 const x=index=>points.length<2?304:70+index/(points.length-1)*468;
 const path=selected.map(({point,index},i)=>(i?'L':'M')+x(index)+','+scale.y(credit(point.balance))).join(' ');
 const line=points.length?svg('Cash balance, in recorded entry order. Exact balances are in the data table.',axes(scale)+
  (points.length>1?'<path class="dashboard-cash-area" d="'+path+' L538,208 L70,208 Z"/>':'')+
  '<path class="dashboard-cash-line" d="'+path+'"/>'+selected.filter((_,i)=>selected.length<=30||i===0||i===selected.length-1).map(({point,index})=>'<circle class="dashboard-cash-dot" cx="'+x(index)+'" cy="'+scale.y(credit(point.balance))+'" r="3.5"><title>'+esc(point.label)+' · '+moneyHtml(point.balance)+'</title></circle>').join('')+
  '<text class="dashboard-axis" x="70" y="237">First entry</text><text class="dashboard-axis" x="538" y="237" text-anchor="end">Latest entry</text>'):empty('No cash entries have been recorded.');
 const rows=points.map(point=>'<tr><th scope="row">'+esc(point.label)+'<span class="dashboard-row-note">'+esc(point.date||'Date not recorded')+'</span></th><td class="number">'+moneyHtml(point.balance)+'</td></tr>');
 return card('cash','Cash balance over time',metric('Current bank',data.currentBank)+line+
  '<p class="dashboard-note">Entries are spaced evenly in recorded order, not by elapsed time.'+(selected.length<points.length?' The chart groups '+points.length+' entries into '+selected.length+' points, preserving each group’s high and low balances. The table includes every entry.':'')+'</p>'+
  '<div class="dashboard-facts">'+metric('Baseline bank',data.baseline.bank)+metric('Change since baseline',String(credit(data.currentBank)-credit(data.baseline.bank)))+'</div>'+
  (rows.length?details('Cash balance data ('+points.length+' entries)',['Entry / campaign date','Bank balance'],rows):''));
}
function resultCard(data){
 const visits=data.visits,shown=visits.slice(-24),offset=visits.length-shown.length;
 const known=shown.filter(visit=>visit.result!==null),scale=extent(known.map(visit=>credit(visit.result))),zero=scale.y(0n),width=468/Math.max(shown.length,1);
 const bars=shown.map((visit,index)=>{
  const x=70+index*width+width*.2,cx=70+(index+.5)*width;
  const label='<text class="dashboard-axis" x="'+cx+'" y="237" text-anchor="middle">'+(offset+index===0?'Start':offset+index)+'</text>';
  if(visit.result===null)return '<text class="dashboard-unknown" x="'+cx+'" y="'+Math.min(201,zero-7)+'" text-anchor="middle">?</text>'+label;
  const value=credit(visit.result),y=scale.y(value),height=Math.max(Math.abs(zero-y),1);
  if(value===0n)return '<line class="dashboard-zero" x1="'+x+'" x2="'+(x+width*.6)+'" y1="'+zero+'" y2="'+zero+'"><title>'+esc(visit.label)+' · '+moneyHtml(visit.result)+'</title></line>'+label;
  return '<rect class="dashboard-result-bar '+(value<0n?'dashboard-loss':'dashboard-gain')+'" x="'+x+'" y="'+(value<0n?zero:Math.min(y,zero-2))+'" width="'+width*.6+'" height="'+height+'"><title>'+esc(visit.label)+' · '+moneyHtml(visit.result)+'</title></rect>'+label;
 }).join('');
 const chart=shown.length?svg('Recorded operating result by jump or visit. Bars above zero are gains; bars below zero are losses. A question mark means unavailable.',axes(scale)+'<line class="dashboard-zero" x1="70" x2="538" y1="'+zero+'" y2="'+zero+'"/>'+bars):empty('No recorded trading or operating activity yet.');
 const rows=visits.map(visit=>'<tr><th scope="row">'+esc(visit.label)+'<span class="dashboard-row-note">'+esc(visit.date||'Date not recorded')+'</span></th><td class="number">'+(visit.salesComplete?moneyHtml(visit.tradeProfit):'Incomplete')+'</td><td class="number">'+moneyHtml(visit.income)+'</td><td class="number">'+moneyHtml(visit.expenses)+'</td><td class="number">'+moneyHtml(visit.result)+(visit.salesComplete?'':'<span class="dashboard-row-note">Incomplete sale audit</span>')+'</td></tr>');
 return card('result','Recorded operating result by jump',
  (data.operatingResult===null?'<div class="dashboard-metric"><span>Total recorded operating result</span><strong>Incomplete records</strong></div>':metric('Total recorded operating result',data.operatingResult))+chart+
  '<p class="dashboard-note">'+(offset?'Latest 24 of '+visits.length+' visits shown. ':'')+'Start = initial visit; numbers = recorded jumps. Each jump starts a destination visit, ending at the next jump. The latest visit is ongoing. Above zero = gain; below zero = loss; ? = unavailable.</p>'+
  (!data.complete?'<p class="dashboard-warning">Some sales lack recorded profit audits. Affected results and the overall result are unavailable.</p>':'')+
  (rows.length?details('Operating result data ('+visits.length+' visits)',['Visit / campaign date','Realized trading','Transport income','Operating expenses','Operating result'],rows):''));
}
function categoryCard(kind,rows){
 const expense=kind==='expenses',title=expense?'Expenses by category':'Income by category',total=sum(rows);
 const nonzero=rows.filter(row=>credit(row.amount)!==0n),magnitude=nonzero.reduce((value,row)=>value+abs(credit(row.amount)),0n);
 let position=0;
 const segments=nonzero.map((row,index)=>{
  const fraction=ratio(abs(credit(row.amount)),magnitude),start=position,angle=(start+fraction/2)*Math.PI*2-Math.PI/2;position+=fraction;
  return '<circle cx="100" cy="100" r="73" fill="none" stroke="'+colors[index%colors.length]+'" stroke-width="25" pathLength="100" stroke-dasharray="'+fraction*100+' '+(100-fraction*100)+'" stroke-dashoffset="'+(-start*100)+'" transform="rotate(-90 100 100)"><title>'+esc(row.label)+' · '+moneyHtml(row.amount)+'</title></circle>'+
   (fraction>=.045?'<text class="dashboard-segment-number" x="'+(100+73*Math.cos(angle))+'" y="'+(104+73*Math.sin(angle))+'" text-anchor="middle">'+(index+1)+'</text>':'');
 }).join('');
 const ring='<svg class="dashboard-donut" viewBox="0 0 200 200" role="img" aria-label="'+esc(title)+'; exact values listed alongside"><title>'+esc(title)+'</title><circle class="dashboard-ring-track" cx="100" cy="100" r="73"/>'+segments+'<text class="dashboard-donut-label" x="100" y="95" text-anchor="middle">'+(expense?'Cash out':'Cash in')+'</text><text class="dashboard-donut-total" x="100" y="117" text-anchor="middle">'+esc(compact(total))+'</text></svg>';
 const labels=nonzero.map((row,index)=>'<tr><th scope="row"><span class="dashboard-key" style="--category-color:'+colors[index%colors.length]+'">'+(index+1)+'</span>'+esc(row.label)+'</th><td class="number">'+moneyHtml(row.amount)+'</td></tr>');
 return card(kind,title,metric(expense?'Total recorded cash expenses':'Total recorded cash income',String(total))+
  (nonzero.length?'<div class="dashboard-category-layout">'+ring+table(title+' · exact Credits',['Category','Amount'],labels)+'</div>':empty(expense?'No recorded cash expenses in this dashboard period.':'No recorded cash income in this dashboard period.'))+
  '<p class="dashboard-note">'+(expense?'Cash outflows include cargo purchases and recorded charges.':'Cash inflows include sale proceeds, transport receipts and any recorded insurance claims.')+' Cash flow is different from operating profit.'+(nonzero.some(row=>credit(row.amount)<0n)?' Ring sizes show absolute amounts; the table retains each amount’s sign.':'')+'</p>');
}
export function dashboardPanel(state){
 const data=dashboardData(state);
 if(!data)return '<section class="dashboard" aria-labelledby="dashboard-heading"><div class="dashboard-heading"><h2 id="dashboard-heading">Dashboard</h2><p>No saved financial baseline yet. '+(state.initialized?'Tracking starts when this campaign is opened for editing. Read-only viewing does not save a starting point.':'Set up or load a campaign to see its recorded finances.')+'</p></div><div class="dashboard-grid">'+[
  ['cash','Cash balance over time'],['result','Recorded operating result by jump'],['expenses','Expenses by category'],['income','Income by category']
 ].map(([id,title])=>card(id,title,empty('Waiting for a saved campaign baseline.'))).join('')+'</div></section>';
 const baseline=data.baseline,adjustment=credit(data.adjustment),otherIn=credit(data.otherInflows),otherOut=credit(data.otherOutflows);
 return '<section class="dashboard" aria-labelledby="dashboard-heading"><div class="dashboard-heading"><div><span class="dashboard-eyebrow">Ship finances</span><h2 id="dashboard-heading">Dashboard</h2></div><p>Recorded from '+esc(data.cashPoints[0]?.date||baseline.dateLabel||'the saved baseline')+' · '+(baseline.origin==='current'?'Current snapshot baseline':'Opening campaign baseline')+'</p></div>'+
  '<div class="dashboard-period"><p>'+(baseline.origin==='current'?'This older campaign starts from its saved current snapshot. Earlier history is not reconstructed.':'Starts with the saved opening bank balance.')+' All totals below use the full recorded dashboard period.</p>'+
  (adjustment!==0n?'<p class="dashboard-warning">Earlier-history adjustment: '+moneyHtml(String(adjustment))+'. Changes before the baseline are reconciled before surviving tracked activity. This adjustment changes cash balance and is excluded from profit.</p>':'')+'</div>'+
  '<div class="dashboard-grid">'+cashCard(data)+resultCard(data)+categoryCard('expenses',data.expenses)+categoryCard('income',data.income)+'</div>'+
  '<div class="dashboard-method"><p><strong>Operating result = realized trading + transport − recorded operating expenses.</strong> It excludes unsold cargo, deposits/corrections, insurance claims and writeoffs. Cash charts show receipts and payments, including cargo purchases, deposits/corrections and insurance claims.</p>'+
  '<p>Other cash movements excluded from income and expense categories: inflows '+moneyHtml(String(otherIn))+'; outflows '+moneyHtml(String(otherOut))+'. The opening baseline is separate.</p></div></section>';
}
