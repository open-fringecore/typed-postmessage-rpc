import {serve} from 'typed-postmessage-rpc/server';
import {mainService, MainServiceType} from './service.mjs';
import {connect} from 'typed-postmessage-rpc/client';

serve({
    service: mainService,
    on: self,
});

const client = await connect<MainServiceType>({
    on: self,
});

console.log(await client.hello.invoke('worker'));
