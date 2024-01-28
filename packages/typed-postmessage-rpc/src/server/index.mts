import type {
    TConnectMessage,
    TInvokeMessage,
    TObserveMessage,
    TRejectMessage,
    TResolveMessage,
} from '../types/messages.mjs';

import type {TProcedure, TRootRouter, TRouter} from '../types/server.mjs';

export function service<ROUTES extends TRouter>(
    routes: ROUTES,
): TRootRouter<ROUTES> {
    return {
        routes: routes,
    };
}

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

export type EmitterCleanupProcedure = () => void;
export type Emitter<EMIT_TYPE extends any> = (
    emit: (data: EMIT_TYPE) => void,
) => EmitterCleanupProcedure;

export class Observable<EMIT_TYPE extends any> {
    constructor(public emitter: Emitter<EMIT_TYPE>) {}
}

export function observable<EMIT_TYPE extends any>(emitter: Emitter<EMIT_TYPE>) {
    return new Observable(emitter);
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

            const cleanupProcedures: {
                [key: number]: () => void;
            } = {};

            port.onmessage = async (message) => {
                if (message.data.type === 'dispose-observer') {
                    if (cleanupProcedures[message.data.seq]) {
                        cleanupProcedures[message.data.seq]();
                        delete cleanupProcedures[message.data.seq];
                    }

                    return;
                }

                if (
                    message.data.type !== 'invoke' &&
                    message.data.type !== 'observe'
                ) {
                    return;
                }

                const data: TInvokeMessage | TObserveMessage = message.data;

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
                    if (message.data.type === 'invoke') {
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
                    } else {
                        const observable: Observable<any> = func(...data.args);

                        cleanupProcedures[data.seq] = observable.emitter(
                            (value: any) => {
                                port.postMessage({
                                    __isTypedPostMessageRPCMessage__: true,
                                    type: 'resolve',
                                    seq: data.seq,
                                    returnValue: value,
                                } as TResolveMessage);
                            },
                        );
                    }
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
