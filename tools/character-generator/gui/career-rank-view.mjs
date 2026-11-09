// Presentation only. Read the latest projected record, never term-history snapshots.
// The public catalog has no rank titles; do not invent titles from numeric ranks.
export function careerRankSummary(state,catalog){
 const careers=state?.character?.careers??[];
 if(!careers.length)return null;
 const active=Number.isInteger(state.active)&&state.active>=0&&!!careers[state.active];
 const record=active?careers[state.active]:careers[careers.length-1];
 const career=catalog?.careers?.find(c=>c.id===record.id);
 const assignment=career?.assignments?.find(a=>a.id===record.assignment);
 const rank=Number.isInteger(record.rank)&&record.rank>=0?record.rank:null;
 return {
  heading:active?'Current career':'Most recent career',
  careerName:career?.name??record.id,
  assignmentName:assignment?.name??record.assignment??'',
  rankLabel:career?.noRank?'No rank system':rank===null?'Rank not recorded':(record.officer?'Officer rank ':'Rank ')+rank
 };
}

export function careerRankView(state,catalog,{esc}){
 const summary=careerRankSummary(state,catalog);
 if(!summary)return '';
 return '<section class="career-rank-summary" aria-label="'+esc(summary.heading)+'"><h3>'+esc(summary.heading)+'</h3><p class="career-rank-career">'+esc(summary.careerName)+(summary.assignmentName?' / '+esc(summary.assignmentName):'')+'</p><strong class="career-rank-value">'+esc(summary.rankLabel)+'</strong></section>';
}
