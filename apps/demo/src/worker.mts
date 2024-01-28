import {mainService} from "./service.mjs";
import {serve} from "typed-postmessage-rpc";

serve({
    service: mainService
});
