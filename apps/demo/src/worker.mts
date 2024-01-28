import {serve} from 'typed-postmessage-rpc';
import {mainService} from './service.mjs';

serve({
    service: mainService,
});
