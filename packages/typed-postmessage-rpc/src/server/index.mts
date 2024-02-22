import {
    TConnectMessage,
    TEmitNextMessage,
    TInvokeMessage,
    TSubscribeMessage,
    TRejectMessage,
    TResolveMessage,
    TEmitErrorMessage,
    TEmitCompleteMessage,
    TEmitAcknowledgeMessage,
    TUnsubscribeMessage,
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

export type Emitter<EMIT_TYPE extends any> = (emit: {
    next: (data: EMIT_TYPE) => void;
    error: (error: any) => void;
    complete: () => void;
}) => EmitterCleanupProcedure;

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
    subscriptionCleanupTimeout,
}: {
    service: TRootRouter<ROUTES>;
    on?: Window | DedicatedWorkerGlobalScope | MessagePort | Worker;
    virtualPort?: number;
    enforceOrigin?: false | [string, ...string[]];
    subscriptionCleanupTimeout?: number;
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

            const subscriptionTracker: {
                [seq: number]: {
                    [emit_seq: number]: {
                        cleanupTimeout?: number;
                    };
                };
            } = {};

            const cleanupProcedures: {
                [key: number]: () => void;
            } = {};

            port.onmessage = async (message) => {
                if (message.data.type === 'unsubscribe') {
                    const m = message.data as TUnsubscribeMessage;

                    if (cleanupProcedures[m.seq]) {
                        cleanupProcedures[m.seq]();
                        delete cleanupProcedures[m.seq];
                    }

                    return;
                }

                if (message.data.type === 'emit-ack') {
                    const m = message.data as TEmitAcknowledgeMessage;

                    if (
                        m.seq in subscriptionTracker &&
                        m.emit_seq in subscriptionTracker[m.seq]
                    ) {
                        clearTimeout(
                            subscriptionTracker[m.seq][m.emit_seq]
                                .cleanupTimeout,
                        );

                        delete subscriptionTracker[m.seq][m.emit_seq];
                    }
                }

                if (
                    message.data.type !== 'invoke' &&
                    message.data.type !== 'subscribe'
                ) {
                    return;
                }

                const data: TInvokeMessage | TSubscribeMessage = message.data;

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
                        let emit_seq = 0;
                        const observable: Observable<any> = func(...data.args);

                        function makeMessage() {
                            return {
                                __isTypedPostMessageRPCMessage__: true,
                                seq: data.seq,
                                emit_seq: emit_seq,
                            };
                        }

                        function scheduleCleanup() {
                            if (!(data.seq in subscriptionTracker)) {
                                subscriptionTracker[data.seq] = {};
                            }

                            subscriptionTracker[data.seq][emit_seq] = {
                                cleanupTimeout: subscriptionCleanupTimeout
                                    ? setTimeout(() => {
                                          cleanupProcedures[data.seq]?.();
                                          delete cleanupProcedures[data.seq];

                                          delete subscriptionTracker[data.seq];
                                      }, subscriptionCleanupTimeout)
                                    : undefined,
                            };
                        }

                        cleanupProcedures[data.seq] = observable.emitter({
                            next: (value: any) => {
                                port.postMessage({
                                    ...makeMessage(),
                                    type: 'emit-next',
                                    emitValue: value,
                                } as TEmitNextMessage);

                                scheduleCleanup();
                                emit_seq++;
                            },
                            error: (error) => {
                                port.postMessage({
                                    ...makeMessage(),
                                    type: 'emit-error',
                                    error: error,
                                } as TEmitErrorMessage);

                                scheduleCleanup();
                                emit_seq++;
                            },
                            complete: () => {
                                cleanupProcedures[data.seq]();

                                port.postMessage({
                                    ...makeMessage(),
                                    type: 'emit-complete',
                                } as TEmitCompleteMessage);
                            },
                        });
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

    if (
        typeof MessagePort !== 'undefined' &&
        resolvedOn instanceof MessagePort
    ) {
        resolvedOn.start();
    }
}
