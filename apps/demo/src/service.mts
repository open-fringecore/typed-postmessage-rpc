import {ServiceType, service} from "typed-postmessage-rpc";

export const mainService = service({
    hello: async (name: string) => {
        return `Hello ${name}!`;
    },
    tomato: () => {}
});

export type MainServiceType = ServiceType<typeof mainService>;
