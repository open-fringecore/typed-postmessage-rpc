import {serve} from 'typed-postmessage-rpc/server';
import {
    exampleService,
    type ExampleServiceType,
} from '../services/exampleService.mjs';
import {connect} from 'typed-postmessage-rpc/client';

serve({
    service: exampleService,
    on: self,
});

const client = await connect<ExampleServiceType>({
    on: self,
});

client.random.subscribe()({
    onNext: (value) => {
        console.log(value);
    },
});
