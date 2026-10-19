import {COMMODITIES} from './player-snapshot-catalog.mjs';
import {playerSnapshotFixture} from './player-snapshot-fixture.mjs';
import {renderPlayerSnapshot} from './player-snapshot-view.mjs';
import {decodeSnapshotEnvelope,PROPOSED_PREFIX} from './player-snapshot-codec.mjs';
const root=document.getElementById('snapshot');
function display() {
  try {
    if(location.hash) {
      if(location.href.length>8192) throw Error('This snapshot link is too long. Ask the operator for a shorter link.');
      const envelope=decodeSnapshotEnvelope(PROPOSED_PREFIX+location.hash.slice(1),{maxUrlLength:8192});
      renderPlayerSnapshot(root,envelope.snapshot);
      const note=document.createElement('p');note.textContent='Costs shown rounded up to Cr'+envelope.rounding+'.';root.prepend(note);
    } else {
      const demo=structuredClone(playerSnapshotFixture);
      for(const rows of [demo.cargo,demo.buy.offers,demo.sell.offers])for(const row of rows)if(!Object.values(COMMODITIES).includes(row.name))row.name='Other';
      renderPlayerSnapshot(root,demo);
    }
  } catch(error) {
    const message=document.createElement('p');message.setAttribute('role','alert');message.textContent=error.message;root.replaceChildren(message);
  }
}
window.addEventListener('hashchange',display);display();
