import type {TRootRouter, TRouter} from '../types/server.mjs';

import {
    TConnectMessage,
    TUnsubscribeMessage,
    TEmitNextMessage,
    TInvokeMessage,
    TSubscribeMessage,
    TRejectMessage,
    TResolveMessage,
    TEmitAcknowledgeMessage,
    TEmitErrorMessage,
    TEmitCompleteMessage,
} from '../types/messages.mjs';

import type {TContext} from '../types/invocation-context.mjs';

import type {TRouted} from '../types/client.mjs';

import {Evt as Event} from 'evt';

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

            if (property === 'subscribe') {
                return (...args: any[]) => {
                    // HANDLER RECEIVER
                    return (options: {
                        onNext?: (data: any) => void;
                        onError?: (error: any) => void;
                        onComplete?: () => void;
                    }) => {
                        const currentSeq = context.seq++;

                        const message: TSubscribeMessage = {
                            __isTypedPostMessageRPCMessage__: true,
                            type: 'subscribe',

                            seq: currentSeq,

                            path: path,
                            args: args,
                        };

                        context.callbacks[currentSeq] = (response) => {
                            if (response.status === 'resolved') {
                                options.onNext?.(response.returnValue);
                            } else if (response.status === 'rejected') {
                                options.onError?.(response.error);
                            } else if (response.status === 'completed') {
                                options.onComplete?.();
                            }
                        };

                        context.port.postMessage(message);

                        // DISPOSER FUNCTION
                        return () => {
                            delete context.callbacks[currentSeq];

                            const message: TUnsubscribeMessage = {
                                __isTypedPostMessageRPCMessage__: true,
                                type: 'unsubscribe',
                                seq: currentSeq,
                            };

                            context.port.postMessage(message);
                        };
                    };
                };
            } else if (property === 'invoke') {
                return (...args: any[]) => {
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
                };
            }

            return proxy([...path, property], context);
        },
    });
}

export async function connect<ROUTER extends TRootRouter<TRouter>>({
    on,
    virtualPort = 80,
    enforceTargetOrigin = false,
    timeout = 5_000,
}: {
    on: Window | Worker | MessagePort | DedicatedWorkerGlobalScope;
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
                    } else if (
                        message.data.type === 'emit-next' ||
                        message.data.type === 'emit-error' ||
                        message.data.type === 'emit-complete'
                    ) {
                        const data:
                            | TEmitNextMessage
                            | TEmitErrorMessage
                            | TEmitCompleteMessage = message.data;

                        const callback = context.callbacks[data.seq];

                        if (!callback) {
                            throw new Error(
                                'received response to a request that was not sent',
                            );
                        }

                        port.postMessage({
                            __isTypedPostMessageRPCMessage__: true,
                            type: 'emit-ack',
                            seq: data.seq,
                            emit_seq: data.emit_seq,
                        } as TEmitAcknowledgeMessage);

                        if (data.type === 'emit-next') {
                            callback({
                                status: 'resolved',
                                returnValue: data.emitValue,
                            });
                        } else if (data.type === 'emit-error') {
                            callback({
                                status: 'rejected',
                                error: data.error,
                            });
                        } else if (data.type === 'emit-complete') {
                            delete context.callbacks[data.seq];

                            callback({
                                status: 'completed',
                            });
                        }
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

    if (typeof window !== 'undefined' && (on as Window).window === on) {
        if (enforceTargetOrigin) {
            (on as Window).postMessage(message, enforceTargetOrigin, [
                transferablePort,
            ]);
        } else {
            (on as Window).postMessage(message, '*', [transferablePort]);
        }
    } else if (
        (typeof Worker !== 'undefined' && on instanceof Worker) ||
        (typeof MessagePort !== 'undefined' && on instanceof MessagePort) ||
        (typeof DedicatedWorkerGlobalScope !== 'undefined' &&
            on instanceof DedicatedWorkerGlobalScope)
    ) {
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
