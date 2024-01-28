import {TRootRouter, TRouter} from '../types/server.mjs';

import {
    TConnectMessage,
    TInvokeMessage,
    TRejectMessage,
    TResolveMessage,
} from '../types/messages.mjs';

import {Evt as Event} from 'evt';

import {TContext} from '../types/invocation-context.mjs';

import {TRouted} from '../types/client.mjs';

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