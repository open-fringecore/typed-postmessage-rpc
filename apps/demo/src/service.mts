import {ServiceType, service} from "typed-postmessage-rpc";

export const mainService = service({
    hello: async (name: string) => {
        return `Hello ${name}!`;
    },
    helloSync: (name: string) => {
        return `Hello ${name}! (this is sync)`;
    },
    tomato: () => {}
});

export type MainServiceType = ServiceType<typeof mainService>;
