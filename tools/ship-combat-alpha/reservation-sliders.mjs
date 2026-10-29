export function reservationSlider(label,id,value,total){
 // Sparse labels keep narrow station popups readable; range inputs retain every integer step.
 const intervals=Math.min(total,total>999?2:total>9?4:10);
 const ticks=[...new Set(Array.from({length:intervals+1},(_,i)=>Math.round(i*total/(intervals||1))))];
 return `<label class="reservation-slider" for="${id}">${label}<output id="${id}-value" for="${id}">${value}</output><input id="${id}" type="range" min="0" max="${total}" step="1" value="${value}" aria-describedby="${id}-limit"><span class="reservation-ticks" aria-hidden="true">${ticks.map(n=>`<span>${n}</span>`).join('')}</span><small id="${id}-limit"></small></label>`;
}
export function syncReservationSliders(root,total,changed=null){
 const a=root.querySelector('#reserved-evasion'),b=root.querySelector('#reserved-gunners');if(!a||!b)return;
 if(changed){const other=changed===a?b:a;changed.value=String(Math.min(Number(changed.value),Math.max(0,total-Number(other.value))));}
 for(const [input,other] of [[a,b],[b,a]]){
  const available=Math.max(0,total-Number(other.value));
  input.setAttribute('aria-valuetext',`${input.value} reserved; ${available} available for this reservation`);
  root.querySelector('#'+input.id+'-value').value=input.value;
  root.querySelector('#'+input.id+'-limit').textContent=`${available} available (${total} total shared thrust)`;
 }
}
