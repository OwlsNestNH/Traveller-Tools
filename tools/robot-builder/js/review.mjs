// DOM-only renderer. Input is the API's read-only review, never engine calculations.
export function renderReview(review, documentRef = globalThis.document) {
  const node = (tag,text,className) => { const item=documentRef.createElement(tag);if(text!==undefined)item.textContent=text;if(className)item.className=className;return item; };
  const root=node('div',undefined,'robot-review');
  root.append(node('h3','Design review','review-title'),node('p',review.status,'review-status'));
  if(review.provisional)root.append(node('p',review.provisionalLabel||'Provisional values only; correct outstanding errors.','review-warning'));
  if(review.unavailable)root.append(node('p','Totals are not calculated; selected components only.','review-warning'));
  for(const group of review.sections){
    const container=node(group.collapsed?'details':'section',undefined,`review-section review-${group.id}`);
    container.append(node(group.collapsed?'summary':'h4',group.title));
    if(group.note)container.append(node('p',group.note,'help'));
    const list=node('dl',undefined,group.kind==='metrics'?'review-metrics':'review-rows');
    for(const record of group.rows){
      const item=node('div',undefined,'review-row');item.append(node('dt',record.label));
      const value=node('dd');value.append(node('span',record.value));
      if(record.detail)value.append(node('small',record.detail,'review-detail'));
      if(record.source)value.append(node('small',record.source,'source'));
      if(record.details?.length){
        const disclosure=node('details',undefined,'review-item-details');
        disclosure.append(node('summary',`${record.label} details`));
        const detailList=node('dl');
        for(const detail of record.details){const pair=node('div'),detailValue=node('dd',detail.value);if(detail.source)detailValue.append(node('small',detail.source,'source'));pair.append(node('dt',detail.label),detailValue);detailList.append(pair);}
        disclosure.append(detailList);value.append(disclosure);
      }
      item.append(value);list.append(item);
    }
    container.append(list);root.append(container);
  }
  return root;
}
