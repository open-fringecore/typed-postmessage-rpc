import {serve} from 'typed-postmessage-rpc/server';
import {
    helloService,
    type HelloServiceType,
} from '../services/helloService.mjs';
import {connect} from 'typed-postmessage-rpc/client';

if (self instanceof SharedWorkerGlobalScope) {
    self.onconnect = async (event) => {
        const port = event.ports[0];

        serve({
            service: helloService,
            on: port,
        });

        const client = await connect<HelloServiceType>({
            on: port,
        });

        console.log(await client.hello.invoke('shared-worker'));
    };
}
