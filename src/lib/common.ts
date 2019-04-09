/** Provides the additional properties built in to the proxy traps. For properties proxied in the state object */
export type _ProxyProps<T> = T & {
    readonly __store_path__: string;
    set_property: (value_object: object) => void;
}

/** Proxied items are proxied all the way down the tree */
export declare type Proxied<T> = _ProxyProps<T> & {
    readonly [P in keyof T]: Proxied<T[P]>;
}

/** A snapshot of the state for the purposes of reverting or re-committing some action  */
export interface MutationHistory {
    type: string | number | symbol,
    stateData: object
}

export type ActionFunction = (opts: {
    commit: (key: string, payload: any) => void,
    dispatch: (key: string, payload: any) => void,
    payload: any
}) => void;

export type MutationFunction = (opts: {
    state: any,
    payload: any
}) => void;

export type ActionsExtention = { set_property: ActionFunction; }
export type MutationsExtention = { set_property: MutationFunction; }

export type ExtendActions<T> = T & ActionsExtention;
export type ExtendMutations<T> = T & MutationsExtention;