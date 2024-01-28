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

export type TObserveMessage = {
    __isTypedPostMessageRPCMessage__: true;
    type: 'observe';
    seq: number;
    path: string[];
    args: any[];
};

export type TDisposeObserveMessage = {
    __isTypedPostMessageRPCMessage__: true;
    type: 'dispose-observer';
    seq: number;
};

export type TResolveMessage = {
    __isTypedPostMessageRPCMessage__: true;
    type: 'resolve';

    seq: number;
    returnValue: any;
};

export type TRejectMessage = {
    __isTypedPostMessageRPCMessage__: true;
    type: 'reject';

    seq: number;
    error: any;
};
