import {TProcedure, TRouter} from './server.mjs';

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
