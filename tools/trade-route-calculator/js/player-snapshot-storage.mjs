// Recipient-only persistence. Never enumerate, import or write campaign storage.
import {CargoTonnageError} from './player-snapshot.mjs?v=territory-resize-20261021-112';
import {decodeSnapshotEnvelope,PROPOSED_PREFIX} from './player-snapshot-codec.mjs?v=territory-resize-20261021-112';
export const RECIPIENT_PREFIX='traveller-player-snapshot:v1:';
const warning='Browser storage is unavailable or full. Changes may not survive closing this page.';
const decode=payload=>decodeSnapshotEnvelope(PROPOSED_PREFIX+payload,{maxUrlLength:8192});
const validName=value=>value===null||(typeof value==='string'&&value.trim().length>0&&value.length<=80&&value.isWellFormed()&&!/[\u0000-\u001f\u007f]/u.test(value));
const validBase=value=>value===null||(typeof value==='string'&&/^(0|[1-9]\d{0,14})(\.\d{1,6})?$/.test(value));
export function createRecipientStore(getStorage) {
  return {
    last() {
      try {const payload=getStorage().getItem(RECIPIENT_PREFIX+'last');if(payload===null)return {payload:null};if(typeof payload!=='string'||payload.length>8192)throw Error();decode(payload);return {payload};}
      catch(error) {if(error instanceof CargoTonnageError)throw error;return {payload:null,warning};}
    },
    open(payload,onNotice=()=>{}) {
      // Validate before any storage access. Exact canonical payload is the snapshot identity.
      const envelope=decode(payload),labels=new Map();let notice='';
      try {
        const raw=getStorage().getItem(RECIPIENT_PREFIX+payload);
        if(raw!==null) {
          if(raw.length>200000)throw Error();const record=JSON.parse(raw);
          if(record?.version!==1||record.payload!==payload||!Array.isArray(record.annotations)||record.annotations.length>600)throw Error();
          const loaded=new Map();
          for(const pair of record.annotations) {
            if(!Array.isArray(pair)||pair.length!==2||typeof pair[0]!=='string')throw Error();
            const match=/^(cargo|buy|sell):(0|[1-9]\d{0,2})$/.exec(pair[0]),entry=pair[1];if(!match||!entry||typeof entry!=='object')throw Error();
            const rows=match[1]==='cargo'?envelope.snapshot.cargo:envelope.snapshot[match[1]].offers;
            if(rows[Number(match[2])]?.name!=='Other'||loaded.has(pair[0])||!validName(entry.name)||!validBase(entry.base))throw Error();
            loaded.set(pair[0],{name:entry.name,base:entry.base});
          }
          for(const pair of loaded)labels.set(...pair);
        }
      }catch {notice='Saved local details could not be read. The original snapshot is unchanged.';}
      const save=()=>{
        try {
          const record=JSON.stringify({version:1,payload,annotations:Array.from(labels)});
          if(record.length>200000)throw Error();
          const storage=getStorage();storage.setItem(RECIPIENT_PREFIX+payload,record);storage.setItem(RECIPIENT_PREFIX+'last',payload);
          return true;
        }catch {onNotice(warning);return false;}
      };
      if(notice)onNotice(notice);save();return {...envelope,labels,save};
    }
  };
}
