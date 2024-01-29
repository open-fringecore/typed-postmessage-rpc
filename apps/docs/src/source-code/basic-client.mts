import {connect} from 'typed-postmessage-rpc/client';

// need the type of the service
import type {HelloServiceType} from './hello-service.mts';

const worker = new Worker(new URL('./worker.mts', import.meta.url), {
    type: 'module',
});

// connect the client
const client = await connect<HelloServiceType>({
    on: worker,
});
