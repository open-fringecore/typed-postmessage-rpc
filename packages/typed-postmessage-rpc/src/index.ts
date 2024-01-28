import {Evt as Event} from 'evt';

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
            ? {
                  invoke: ROUTES[KEY];
              }
            : {
                  invoke: (
                      ...args: Parameters<ROUTES[KEY]>
                  ) => Promise<ReturnType<ROUTES[KEY]>>;
              }
        : ROUTES[KEY] extends TRouter
        ? TRouted<ROUTES[KEY]>
        : never;
};

type TContext = {
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

type TConnectMessage = {
    __isTypedPostMessageRPCMessage__: true;
    type: 'connect';
    virtualPort: number;
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

const stubFunc = () => {};
const stubObj = {};

function proxy(path: string[], context: TContext, stub: any = stubObj): any {
    return new Proxy(stub, {
        get(target, property) {
            if (typeof property !== 'string') {
                throw new Error(
                    'can not access properties that are not strings due to serialization between browser contexts',
                );
            }

            if (property === 'invoke') {
                return proxy([...path], context, stubFunc);
            } else {
                return proxy([...path, property], context);
            }
        },
        apply(target, thisObject, args) {
            return new Promise((accept, reject) => {
                const currentSeq = context.seq++;

                const message: TInvokeMessage = {
                    __isTypedPostMessageRPCMessage__: true,
                    type: 'invoke',

                    seq: currentSeq,

                    path: path,
                    args: args,
                };

                context.callbacks[currentSeq] = (response) => {
                    if (response.status === 'resolved') {
                        accept(response.returnValue);
                    } else if (response.status === 'rejected') {
                        reject(response.error);
                    }

                    delete context.callbacks[currentSeq];
                };

                context.port.postMessage(message);
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

export function serve<ROUTES extends TRouter>({
    service,
    on,
    virtualPort = 80,
    enforceOrigin = false,
}: {
    service: TRootRouter<ROUTES>;
    on?: Window | DedicatedWorkerGlobalScope | MessagePort | Worker;
    virtualPort?: number;
    enforceOrigin?: false | [string, ...string[]];
}) {
    const resolvedOn = on
        ? on
        : typeof Window !== 'undefined' && self instanceof Window
        ? window
        : typeof DedicatedWorkerGlobalScope !== 'undefined' &&
          self instanceof DedicatedWorkerGlobalScope
        ? self
        : null;

    if (!resolvedOn) {
        throw new Error(
            'not window or worker scope, must provide postMessage() able port.',
        );
    }

    const connectionListener: any = (message: MessageEvent<any>) => {
        const validOrigin =
            !enforceOrigin ||
            enforceOrigin.some((origin) => message.origin.startsWith(origin));

        if (!validOrigin) {
            return;
        }

        if ('__isTypedPostMessageRPCMessage__' in message.data) {
            if (message.data.type !== 'connect') {
                return;
            }

            const data: TConnectMessage = message.data;

            if (data.virtualPort !== virtualPort) {
                return;
            }

            const port = message.ports[0];

            port.onmessage = async (message) => {
                if (message.data.type !== 'invoke') {
                    return;
                }

                const data: TInvokeMessage = message.data;

                const func = (() => {
                    try {
                        return findProcedure(service.routes, data.path);
                    } catch {
                        return undefined;
                    }
                })();

                if (!func) {
                    port.postMessage({
                        __isTypedPostMessageRPCMessage__: true,
                        type: 'reject',
                        seq: data.seq,
                        error: 'not-found',
                    } as TRejectMessage);

                    return;
                }

                try {
                    const returnedValue = func(...data.args);

                    const resolvedValue =
                        returnedValue instanceof Promise
                            ? await returnedValue
                            : returnedValue;

                    port.postMessage({
                        __isTypedPostMessageRPCMessage__: true,
                        type: 'resolve',
                        seq: data.seq,
                        returnValue: resolvedValue,
                    } as TResolveMessage);
                } catch (error) {
                    port.postMessage({
                        __isTypedPostMessageRPCMessage__: true,
                        type: 'reject',
                        seq: data.seq,
                        error: `${error}`,
                    } as TRejectMessage);
                }
            };

            port.postMessage({
                __isTypedPostMessageRPCMessage__: true,
                type: 'connect',
                virtualPort: virtualPort,
            } as TConnectMessage);
        }
    };

    resolvedOn.addEventListener('message', connectionListener);
}

export async function connect<ROUTER extends TRootRouter<TRouter>>({
    on,
    virtualPort = 80,
    enforceTargetOrigin = false,
    timeout = 5_000,
}: {
    on: Window | Worker | MessagePort;
    virtualPort?: number;
    enforceTargetOrigin?: false | string;
    timeout?: number;
}): Promise<TRouted<ROUTER['routes']>> {
    const channel = new MessageChannel();
    const [port, transferablePort] = [channel.port1, channel.port2];

    const message: TConnectMessage = {
        __isTypedPostMessageRPCMessage__: true,
        type: 'connect',
        virtualPort: virtualPort,
    };

    const event = Event.create<boolean>();

    port.onmessage = (message: MessageEvent<any>) => {
        if ('__isTypedPostMessageRPCMessage__' in message.data) {
            if (message.data.type !== 'connect') {
                return;
            }

            const data: TConnectMessage = message.data;

            if (data.virtualPort !== virtualPort) {
                return;
            }

            event.post(true);

            port.onmessage = (message: MessageEvent<any>) => {
                if ('__isTypedPostMessageRPCMessage__' in message.data) {
                    if (message.data.type === 'resolve') {
                        const data: TResolveMessage = message.data;

                        const callback = context.callbacks[data.seq];

                        if (!callback) {
                            throw new Error(
                                'received response to a request that was not sent',
                            );
                        }

                        callback({
                            status: 'resolved',
                            returnValue: data.returnValue,
                        });
                    } else if (message.data.type === 'reject') {
                        const data: TRejectMessage = message.data;

                        const callback = context.callbacks[data.seq];

                        if (!callback) {
                            throw new Error(
                                'received response to a request that was not sent',
                            );
                        }

                        callback({
                            status: 'rejected',
                            error: data.error,
                        });
                    }
                }
            };
        }
    };

    if (typeof Window !== 'undefined' && on instanceof Window) {
        if (enforceTargetOrigin) {
            on.postMessage(message, enforceTargetOrigin, [transferablePort]);
        } else {
            on.postMessage(message, '*', [transferablePort]);
        }
    } else if (on instanceof Worker || on instanceof MessagePort) {
        on.postMessage(message, [transferablePort]);
    }

    setTimeout(() => {
        event.post(false);
    }, timeout);

    const success = await event.waitFor();

    if (!success) {
        throw new Error('timeout, could not connect');
    }

    const context: TContext = {
        virtualPort: virtualPort,
        on: on,
        seq: 0,
        callbacks: {},
        port: port,
    };

    return proxy([], context);
}
