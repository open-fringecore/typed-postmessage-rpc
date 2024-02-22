import {serve} from 'typed-postmessage-rpc/server';
import {
    exampleService,
    type ExampleServiceType,
} from '../services/exampleService.mjs';
import {connect} from 'typed-postmessage-rpc/client';

if (self instanceof SharedWorkerGlobalScope) {
    self.onconnect = async (event) => {
        const port = event.ports[0];

        serve({
            service: exampleService,
            on: port,
        });

        const client = await connect<ExampleServiceType>({
            on: port,
        });

        console.log(await client.hello.invoke('shared-worker'));
    };
}
