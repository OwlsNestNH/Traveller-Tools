import {COMMODITIES} from './player-snapshot-catalog.mjs';
import {playerSnapshotFixture} from './player-snapshot-fixture.mjs?v=map-details-20261020-101';
import {renderPlayerSnapshot,clearPlayerSnapshotMap} from './player-snapshot-view.mjs?v=map-details-20261020-101';
import {createRecipientStore} from './player-snapshot-storage.mjs?v=map-details-20261020-101';
const root=document.getElementById('snapshot'),store=createRecipientStore(()=>localStorage);
function display() {
  clearPlayerSnapshotMap(root);
  try {
    let payload=location.hash.slice(1),notice='';
    if(location.href.length>8192)throw Error('This snapshot link is too long. Ask the operator for a shorter link.');
    if(!payload){const last=store.last();payload=last.payload;notice=last.warning||'';}
    document.getElementById('snapshot-mode').textContent=payload?'Read-only snapshot · no transactions':'Synthetic example · no campaign data';
    const status=document.createElement('p');status.setAttribute('role','status');
    const onNotice=message=>{notice=message;status.textContent=message;};
    if(payload) {
      const saved=store.open(payload,onNotice);
      renderPlayerSnapshot(root,saved.snapshot,{annotations:saved.labels,onAnnotationsChange:saved.save,rounding:saved.rounding});
    } else {
      const demo=structuredClone(playerSnapshotFixture);
      for(const rows of [demo.cargo,demo.buy.offers,demo.sell.offers])for(const row of rows)if(!Object.values(COMMODITIES).includes(row.name))row.name='Other';
      renderPlayerSnapshot(root,demo);
    }
    status.textContent=notice;root.prepend(status);
  } catch(error) {
    const message=document.createElement('p');message.setAttribute('role','alert');message.textContent=error.message;root.replaceChildren(message);
  }
}
window.addEventListener('hashchange',display);display();
