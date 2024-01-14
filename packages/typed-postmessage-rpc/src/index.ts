export const name = 'typed-postmessage-rpc';

export type TProcedure<INPUT extends any[] = any[], OUTPUT extends any = any> =
    | ((...args: INPUT) => Promise<OUTPUT>)
    | ((...args: INPUT) => OUTPUT);

export type TRouter = {
    [key: string]: TRouter | TProcedure;
};

export type TRootRouter<ROUTES extends TRouter> = {
    routes: ROUTES;
};

export function service<ROUTES extends TRouter>(
    routes: ROUTES,
): TRootRouter<ROUTES> {
    return {
        routes: routes,
    };
}

export type ServiceType<ROUTER extends TRootRouter<TRouter>> = ROUTER;

export type TRouted<ROUTES extends TRouter> = {
    [KEY in keyof ROUTES]: ROUTES[KEY] extends TProcedure
        ? ReturnType<ROUTES[KEY]> extends Promise<any>
            ? ROUTES[KEY]
            : (
                  ...args: Parameters<ROUTES[KEY]>
              ) => Promise<ReturnType<ROUTES[KEY]>>
        : ROUTES[KEY] extends TRouter
        ? TRouted<ROUTES[KEY]>
        : never;
};

let seq = 0;

type TContext = {
    receiveOn: Window | Worker | MessagePort | DedicatedWorkerGlobalScope;
    sendOn: Window | Worker | MessagePort | DedicatedWorkerGlobalScope;
};

type TInvokeMessage = {
    __isTypedPostMessageRPCMessage__: true;
    type: 'invoke';

    seq: number;

    path: string[];
    args: any[];
};

type TResolveMessage = {
    __isTypedPostMessageRPCMessage__: true;
    type: 'resolve';

    seq: number;
    returnValue: any;
};

type TRejectMessage = {
    __isTypedPostMessageRPCMessage__: true;
    type: 'reject';

    seq: number;
    error: any;
};

const callbacks: {
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
} = {};

const stubFunc = () => {};

function proxy(path: string[], context: TContext): any {
    // console.log();

    return new Proxy(stubFunc, {
        get(target, property) {
            if (typeof property !== 'string') {
                throw new Error(
                    'can not access properties that are not strings due to serialization between browser contexts',
                );
            }

            return proxy([...path, property], context);
        },
        apply(target, thisObject, args) {
            return new Promise((accept, reject) => {
                const currentSeq = seq++;

                const message: TInvokeMessage = {
                    __isTypedPostMessageRPCMessage__: true,
                    type: 'invoke',

                    seq: currentSeq,

                    path: path,
                    args: args,
                };

                callbacks[currentSeq] = (response) => {
                    if (response.status === 'resolved') {
                        accept(response.returnValue);
                    } else if (response.status === 'rejected') {
                        reject(response.error);
                    }

                    delete callbacks[currentSeq];
                };

                if (
                    typeof Window !== 'undefined' &&
                    context.sendOn instanceof Window
                ) {
                    context.sendOn.postMessage(message, '*');
                } else if (
                    context.sendOn instanceof MessagePort ||
                    context.sendOn instanceof Worker ||
                    context.sendOn instanceof DedicatedWorkerGlobalScope
                ) {
                    context.sendOn.postMessage(message);
                }
            });
        },
    });
}

const registeredListeners = new Map<
    Window | Worker | MessagePort | DedicatedWorkerGlobalScope,
    {
        consumer: boolean;
        service: boolean;
    }
>();

function findProcedure(
    service: TRouter | TProcedure | undefined,
    path: string[],
): TProcedure {
    if (path.length === 0) {
        if (service instanceof Function) {
            return service;
        } else {
            throw new Error(`can not find the procedure`);
        }
    }

    if (typeof service === 'object') {
        return findProcedure(service[path[0]], path.slice(1, path.length));
    } else {
        throw new Error(
            'can not find the procedure as path is pre-terminated with a non-object',
        );
    }
}

export function serve<ROUTES extends TRouter>(options: {
    service: TRootRouter<ROUTES>;
    respondOn: Window | Worker | MessagePort | DedicatedWorkerGlobalScope;
    receiveOn: Window | Worker | MessagePort | DedicatedWorkerGlobalScope;
}) {
    const listener: any = async (event: MessageEvent<any>) => {
        if (
            event.data?.__isTypedPostMessageRPCMessage__ &&
            event.data.type === 'invoke'
        ) {
            const data: TInvokeMessage = event.data;

            try {
                const procedure = findProcedure(
                    options.service.routes,
                    data.path,
                );

                const returnValue = procedure(...data.args);

                const result =
                    returnValue instanceof Promise
                        ? await returnValue
                        : returnValue;

                const message: TResolveMessage = {
                    __isTypedPostMessageRPCMessage__: true,
                    type: 'resolve',
                    seq: data.seq,
                    returnValue: result,
                };

                if (
                    typeof Window !== 'undefined' &&
                    options.respondOn instanceof Window
                ) {
                    options.respondOn.postMessage(message, '*');
                } else {
                    options.respondOn.postMessage(message);
                }
            } catch (error) {
                console.error(error);

                const message: TRejectMessage = {
                    __isTypedPostMessageRPCMessage__: true,
                    type: 'reject',
                    seq: data.seq,
                    error: `${error}`,
                };

                if (
                    typeof Window !== 'undefined' &&
                    options.respondOn instanceof Window
                ) {
                    options.respondOn.postMessage(message, '*');
                } else {
                    options.respondOn.postMessage(message);
                }
            }
        }
    };

    options.receiveOn.addEventListener('message', listener);
}

export function consumer<ROUTER extends TRootRouter<TRouter>>() {
    return {
        connect(options: {
            receiveOn:
                | Window
                | Worker
                | MessagePort
                | DedicatedWorkerGlobalScope;

            sendOn: Window | Worker | MessagePort | DedicatedWorkerGlobalScope;
        }): TRouted<ROUTER['routes']> {
            const context: TContext = {
                receiveOn: options.receiveOn,
                sendOn: options.sendOn,
            };

            if (!registeredListeners.has(options.receiveOn)) {
                const listener: any = (event: MessageEvent) => {
                    if (event.data?.__isTypedPostMessageRPCMessage__) {
                        const data:
                            | TInvokeMessage
                            | TResolveMessage
                            | TRejectMessage = event.data;

                        if (data.type !== 'resolve' && data.type !== 'reject') {
                            return;
                        }

                        const seq = data.seq;
                        const callback = callbacks[seq];

                        if (!callback) {
                            return;
                        }

                        if (data.type === 'reject') {
                            callback({
                                status: 'rejected',
                                error: data.error,
                            });
                        } else if (data.type === 'resolve') {
                            callback({
                                status: 'resolved',
                                returnValue: data.returnValue,
                            });
                        }

                        delete callbacks[seq];
                    }
                };

                options.receiveOn.addEventListener('message', listener);

                const previousRegistration = registeredListeners.get(
                    options.receiveOn,
                );

                registeredListeners.set(options.receiveOn, {
                    consumer: true,
                    service: previousRegistration?.service ?? false,
                });
            }

            return proxy([], context);
        },
    };
}
