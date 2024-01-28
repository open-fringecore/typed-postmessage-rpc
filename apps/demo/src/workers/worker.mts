import { serve } from "typed-postmessage-rpc/server";
import {
  helloService,
  type HelloServiceType,
} from "../services/helloService.mjs";
import { connect } from "typed-postmessage-rpc/client";

serve({
  service: helloService,
  on: self,
});

const client = await connect<HelloServiceType>({
  on: self,
});

console.log(await client.hello.invoke("worker"));
