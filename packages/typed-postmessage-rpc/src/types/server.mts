export type TProcedure<INPUT extends any[] = any[], OUTPUT extends any = any> =
    | ((...args: INPUT) => Promise<OUTPUT>)
    | ((...args: INPUT) => OUTPUT);

export type TRouter = {
    [key: string]: TRouter | TProcedure;
};

export type TRootRouter<ROUTES extends TRouter> = {
    routes: ROUTES;
};

export type ServiceType<ROUTER extends TRootRouter<TRouter>> = ROUTER;
