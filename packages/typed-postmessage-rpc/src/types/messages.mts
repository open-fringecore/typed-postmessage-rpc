export type TConnectMessage = {
    __isTypedPostMessageRPCMessage__: true;
    type: 'connect';
    virtualPort: number;
};

export type TInvokeMessage = {
    __isTypedPostMessageRPCMessage__: true;
    type: 'invoke';
    seq: number;
    path: string[];
    args: any[];
};

export type TSubscribeMessage = {
    __isTypedPostMessageRPCMessage__: true;
    type: 'subscribe';
    seq: number;
    path: string[];
    args: any[];
};

export type TUnsubscribeMessage = {
    __isTypedPostMessageRPCMessage__: true;
    type: 'unsubscribe';
    seq: number;
};

export type TResolveMessage = {
    __isTypedPostMessageRPCMessage__: true;
    type: 'resolve';

    seq: number;
    returnValue: any;
};

export type TEmitNextMessage = {
    __isTypedPostMessageRPCMessage__: true;
    type: 'emit-next';

    seq: number;
    emit_seq: number;
    emitValue: any;
};

export type TEmitErrorMessage = {
    __isTypedPostMessageRPCMessage__: true;
    type: 'emit-error';

    seq: number;
    emit_seq: number;
    error: any;
};

export type TEmitCompleteMessage = {
    __isTypedPostMessageRPCMessage__: true;
    type: 'emit-complete';

    seq: number;
    emit_seq: number;
};

export type TEmitAcknowledgeMessage = {
    __isTypedPostMessageRPCMessage__: true;
    type: 'emit-ack';

    seq: number;
    emit_seq: number;
};

export type TRejectMessage = {
    __isTypedPostMessageRPCMessage__: true;
    type: 'reject';

    seq: number;
    error: any;
};
