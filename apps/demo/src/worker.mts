import {mainService} from "./service.mjs";
import {serve} from "typed-postmessage-rpc";

if (self instanceof DedicatedWorkerGlobalScope) {
    serve({
        service: mainService,
        receiveOn: self,
        respondOn: self,
    });
}
