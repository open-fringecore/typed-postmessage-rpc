import {serve} from 'typed-postmessage-rpc/server';
import {mainService} from './service.mjs';

serve({
    service: mainService,
});
