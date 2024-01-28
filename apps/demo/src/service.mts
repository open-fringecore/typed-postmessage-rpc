import {service, observable} from 'typed-postmessage-rpc/server';
import {ServiceType} from 'typed-postmessage-rpc/server';

export const mainService = service({
    hello: async (name: string) => {
        return `Hello ${name}!`;
    },
    helloSync: (name: string) => {
        return `Hello ${name}! (this is sync)`;
    },
    randomStream: (upper: number, lower: number) => {
        return observable<number>((emit) => {
            const interval = setInterval(() => {
                emit(lower + Math.random() * (upper - lower));
            }, 2000);

            return () => {
                console.log('server: disposed.');
                clearInterval(interval);
            };
        });
    },
});

export type MainServiceType = ServiceType<typeof mainService>;
