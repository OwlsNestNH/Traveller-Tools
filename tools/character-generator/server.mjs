import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { api } from './engine/session.mjs';
import { createRulesServer } from './server-runtime.mjs';
export function createServer(){return createRulesServer(api);}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const port=Number(process.env.PORT??8781);if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid PORT.');
 createServer().listen(port,'127.0.0.1',()=>console.log('Character generator: http://127.0.0.1:'+port+'/?api=local'));
}
