import {TProcedure, TRouter} from './server.mjs';
import {Observable} from '../server/index.mjs';

export type TRouted<ROUTES extends TRouter> = {
    [KEY in keyof ROUTES]: ROUTES[KEY] extends TProcedure
        ? ReturnType<ROUTES[KEY]> extends Promise<any>
            ? {
                  invoke: ROUTES[KEY];
              }
            : ReturnType<ROUTES[KEY]> extends Observable<infer EMIT_TYPE>
            ? {
                  observe: (
                      ...args: Parameters<ROUTES[KEY]>
                  ) => (listener: (data: EMIT_TYPE) => void) => () => void;
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
