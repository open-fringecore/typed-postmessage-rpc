import {serve} from 'typed-postmessage-rpc/server';
import {helloService} from './hello-service.mjs';

// type-guard; completely optional.
if (self instanceof WorkerGlobalScope) {
    serve({
        service: helloService,
        on: self,
    });
}
