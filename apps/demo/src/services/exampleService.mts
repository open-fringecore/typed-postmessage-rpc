import {
    observable,
    service,
    type ServiceType,
} from 'typed-postmessage-rpc/server';

export const exampleService = service({
    hello: async (name: string) => {
        return `Hello ${name}!`;
    },
    random: () => {
        return observable<number>((emit) => {
            let i = 0;

            const interval = setInterval(() => {
                const random = Math.random();

                console.log('server: sending', random);
                emit.next(random);

                if ((i & 1) === 1) {
                    emit.error(new Error('no worries.'));
                }

                if (i++ > 10) {
                    emit.complete();
                }
            }, 1000);

            return () => {
                console.log('server: cleanup.');
                clearInterval(interval);
            };
        });
    },
});

export type ExampleServiceType = ServiceType<typeof exampleService>;
