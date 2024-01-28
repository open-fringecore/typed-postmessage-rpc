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