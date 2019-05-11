import EventManager from "./lib/EventManager";
import { MutationFunction, ActionFunction, Proxied, ExtendActions, MutationHistory, ExtendMutations } from "./lib/common";
import { isObj, deepCopy, isArray, deep_diff, warn, error, STATE_CHANGED } from "./lib/utils";
    
/** A set of mutations to be committed on some Store */
interface MutationsMap {
    [key: string]: MutationFunction;
}

/** A set of actions to be dispatched by some Store */
interface ActionsMap {
    [key: string]: ActionFunction;
}

class Store<StateType extends object, ActionsType extends ActionsMap, MutationsType extends MutationsMap> {
    public readonly actions: ExtendActions<ActionsType>;
    public readonly mutations: ExtendMutations<MutationsType>;

    // Public read-only access to the accessor tree
    public readonly state: Proxied<StateType>;
    // Accessor tree
    protected state_accessor: Proxied<StateType>;
    // Single point of truth, state tree
    private internal_state: any;

    private is_mutating: boolean = false;
    private is_silently_modifying: boolean = false;
    private events: EventManager;
    private history: Array<MutationHistory> = [];
    private future: Array<MutationHistory> = [];
    private currentHistoryBatch: Array<MutationHistory> = [];
    private history_checkpoint: any;
    private copiedItem: any;

    constructor(params) {
        this.actions = params.actions || {};
        this.mutations = Object.assign({
            set_property({ state, payload: { value_object, path } }) {
                var current = state;
                path.forEach((part) => {
                    current = current[part];
                });

                Object.keys(value_object).forEach((key) => {
                    current[key] = value_object[key];
                });
            }
        }, params.mutations);

        this.events = new EventManager();
        this.setup_state(params.state || {});

        /** State is a readonly alias of state_accessor (which is internal) 
         * This allows us to provide static checks against writing to state */
        this.state = new Proxy(this.state_accessor, {
            get(target, prop, receiver) {
                return Reflect.get(target, prop, receiver);
            }
        });
    }

    public setup_state(new_state: StateType) {
        if (this.internal_state) {
            this.internal_state.load(new_state);
        } else {
            this.internal_state = new_state;
        }
        this.history = [];
        this.future = [];
        this.history.push({
            type: "INIT_STATE",
            stateData: deepCopy(this.internal_state)
        });
        this.state_accessor = this.proxy_by_path([]);
        this.update_state();
        this.events.fire(STATE_CHANGED, []);
    }

    /**
     * Saves a reference point for creating a history object when did_update is called
     * @param path path of the item to change
     */
    public will_update(path?: string[] | string) {
        // build a deep copy of what is at path 
        if (path && !isArray(path)) {
            path = (<string>path).split(".");
        }
        this.history_checkpoint = deepCopy(this.get_value_by_path(path as string[]));
    }

    public did_update(path?: string[] | string) {
        if (path && !isArray(path)) {
            path = (<string>path).split(".");
        }
        this.events.fire(STATE_CHANGED, path || []);
        if (!this.history_checkpoint)
            return;
        // diff what is at path and what was at path and save that to history
        var currentPath = path as string[],
            diffObject = deep_diff(this.history_checkpoint, this.get_value_by_path(currentPath)),
            state_diff = {},
            build_tree = (obj, i = 0) => {
                var current_value = {},
                    key = currentPath[i],
                    next = ++i < currentPath.length ? currentPath[i] : null;
                if (next) {
                    build_tree(current_value, i);
                } else {
                    // We are at the bottom of the path, place the diff object here
                    current_value = diffObject;
                }
                obj[key] = current_value;
            };
        build_tree(diffObject);

        // put it into history
        this.currentHistoryBatch.push({
            stateData: state_diff,
            type: 'BatchedMutation'
        });
        this.commit_history_batch();
        this.history_checkpoint = null;
    }

    /** Creates a proxy for the object held at the path relative to `_state`, provides access to that path through `obj.__store_path__`
     * @param path The property names of each of the ancestors of the property leading back to `_state`
     * @returns A proxy of the child of `_state` described by `path`
     */
    public proxy_by_path(path: string[]) {
        var proxy_set = (state, key, value) => {
            // Only mutate state when permissible, always notify of changes
            if (this.is_mutating) {
                this.currentHistoryBatch.push({
                    stateData: deepCopy(state),
                    type: key
                });

                Reflect.set(state, key, value);
                this.events.fire(STATE_CHANGED, path.concat([key]));
                return true;
            } else if (this.is_silently_modifying) {
                Reflect.set(state, key, value);
                return true;
            }
            warn("Do not set state objects directly, use an action or mutation");
            return true;
        };
        var proxy_get = (target, property, receiver) => {
            switch (property) {
                case '__store_path__':
                    return path.join('.');
                    break;
                case 'set_property':
                    return (value_object: object) => {
                        this.commit('set_property', { value_object, path });
                    }
                    break;
                default:
                    return Reflect.get(target, property, receiver);
                    break;
            }
        };
        return new Proxy(this.get_value_by_path(path), {
            get: proxy_get,
            set: proxy_set
        })
    }

    /** Fires `callback` when `path` has been changed
     * @param callback Fires when `path has been changed
     * @param path The path or paths to check. Paths are property names concatenated by '.'
     * @returns String ID of the event handler which can be used to destruct the event handler
     */
    public add_observer(path: string[] | string, callback: (...args) => void) {
        var check_paths = (<string[]>(isArray(path) ? path : [path])).map((str) => str.split('.'));

        var handler_id = this.events.on(STATE_CHANGED, callback, (changed_path: string[]) => {
            if (changed_path.length < 1) {
                return true;
            }

            var found_match = check_paths.find((check_path) => {
                // Find the first item along the observed path that does not match the changed path
                // Note: if the observed path is shorter, it will fire on any changes to changed children
                var found_diff = check_path.find((prop, index) => {
                    return check_path[index] !== '@each' && check_path[index] !== changed_path[index];
                });

                return found_diff === undefined;
            });

            return found_match !== undefined;
        });

        return handler_id;
    }

    /** Destructs the event handler with id `handler_id`
     * @param handler_id The id of the handler to destruct
     */
    public remove_observer(handler_id: string) {
        this.events.off(STATE_CHANGED, handler_id);
    }

    // Undo / Redo currently is a very heavy implementation currently
    // this needs to be rethought for module support
    /** Reverts the most recent action */
    public undo() {
        var lastMutation = this.history.pop(),// This is the mutation that brings us to our current state
            previousMutation = this.history.length > 0 ? this.history[this.history.length - 1] : null;
        if (!previousMutation) {
            throw "Calling undo with no history";
        }
        this.future.unshift(lastMutation); // Push our current state into the future
        this.is_silently_modifying = true;
        this.internal_state.load(deepCopy(previousMutation.stateData));
        this.update_state();
        this.is_silently_modifying = false;
        this.did_update([]);
    }

    /** Commits the last reverted action */
    public redo() {
        var nextMutation = this.future.shift();
        if (!nextMutation) {
            throw "Calling redo with no future";
        }
        this.history.push(nextMutation);
        this.is_silently_modifying = true;
        this.internal_state.load(deepCopy(nextMutation.stateData));
        this.update_state();
        this.is_silently_modifying = false;
        this.did_update([]);
    }

    /** Calls an action `key` with paramater `payload` */
    public dispatch<K extends Extract<keyof ExtendActions<ActionsType>, string>>(key: K, payload?: any) {
        if (!this.actions[key]) {
            error(`Action dispatched that does not exist: ${key}`);
            return;
        }
        return this.actions[key]({
            commit: this.commit.bind(this),
            dispatch: this.dispatch.bind(this),
            payload
        });
    }

    /** Calls an mutation `key` with paramater `payload`, should only be called from actions */
    public commit<K extends Extract<keyof ExtendMutations<MutationsType>, string>>(key: K, payload?: any) {
        this.is_mutating = true;

        var params = {
            state: this.state_accessor,
            payload
        };
        var return_value = this.mutations[key](params);
        this.update_state();

        if (!this.history_checkpoint)
            this.commit_history_batch();

        this.is_mutating = false;
        return return_value;
    }

    private commit_history_batch() {
        var mutation = deepCopy(this.state_accessor);
        this.currentHistoryBatch.forEach((mutationPiece) => {
            mutation = Object.assign(mutation, mutationPiece.stateData);
        });
        this.history.push({
            type: "Mutation",
            stateData: mutation
        });
        this.currentHistoryBatch = [];
    }

    /** Returns an object in the state located at the path array
     * @param path Array of strings representing a succession of children of `_state`
     */
    public get_value_by_path(path: string[]) {
        var current = this.internal_state;
        path.forEach((part) => {
            current = current[part];
        });
        return current;
    }

    /** Updates all objects in the state to be proxies and be accessible by path */
    private update_state() {
        var currentPath = [],
            walk_state = (obj) => {
                Object.keys(obj).forEach((key) => {
                    if ((isObj(obj[key]) || isArray(obj[key])) && obj.propertyIsEnumerable(key)) {
                        currentPath.push(key);
                        walk_state(obj[key]);
                        currentPath.pop();
                        if (!obj[key].__store_path__ && obj.propertyIsEnumerable(key)) {
                            // not a proxy
                            this.is_silently_modifying = true;
                            obj[key] = this.proxy_by_path([].concat(currentPath, [key]));
                            this.is_silently_modifying = false;
                        }
                    }
                });
            }
        walk_state(this.state_accessor);
    }
}

export { Store, ActionsMap, MutationsMap, Proxied }