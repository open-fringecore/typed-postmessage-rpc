import { service, type ServiceType } from "typed-postmessage-rpc/server";

export const helloService = service({
  hello: async (name: string) => {
    return `Hello ${name}!`;
  },
});

export type HelloServiceType = ServiceType<typeof helloService>;
