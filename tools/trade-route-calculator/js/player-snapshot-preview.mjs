import {playerSnapshotFixture} from './player-snapshot-fixture.mjs';
import {renderPlayerSnapshot} from './player-snapshot-view.mjs';
// Stage one deliberately ignores URL data, storage and production app state.
renderPlayerSnapshot(document.getElementById('snapshot'), playerSnapshotFixture);
