export type TContext = {
    virtualPort: number;
    on: Window | Worker | MessagePort | DedicatedWorkerGlobalScope;
    callbacks: {
        [key: number]: (
            response:
                | {
                status: 'resolved';
                returnValue: any;
            }
                | {
                status: 'rejected';
                error: any;
            },
        ) => void;
    };
    port: MessagePort;
    seq: number;
};