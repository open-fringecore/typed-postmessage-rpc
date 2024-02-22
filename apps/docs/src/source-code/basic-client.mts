import {connect} from 'typed-postmessage-rpc/client';
import type {HelloServiceType} from './hello-service.mts';

const worker = new Worker(new URL('./worker.mts', import.meta.url), {
    type: 'module',
});

const client = await connect<HelloServiceType>({
    on: worker,
});
