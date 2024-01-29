import {connect} from 'typed-postmessage-rpc/client';
import type {HelloServiceType} from './hello-service.mts';

const worker = new Worker(new URL('./worker.mts', import.meta.url), {
    type: 'module',
});

const client = await connect<HelloServiceType>({
    on: worker,
});

const result = await client.hello.invoke('RPC'); // this is the magic.

console.log(result);
