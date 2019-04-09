import { make_guid, warn } from "./utils";

type EventHandle = {
    check_func?: (...args) => boolean,
    callback: (...args) => void
}

export default class EventManager {
    // Maps cannot be used properly with bracket syntax, be careful!
    queue: Map<string, Map<string, EventHandle>> = new Map();

    /** Calls _callback_ when event _e_ is fired and check_func returns true 
     * @param e The event identifier on which to callback
     * @param callback The function to be fired when the event is called
     * @param check_func To check the contents of the payload and decide whether to call the callback
    */
    on(e: string, callback: (...args) => void, check_func?: (...args) => boolean) {
        var guid = make_guid();

        if (!this.queue.has(e))
            this.queue.set(e, new Map());

        this.queue.get(e).set(guid, { callback, check_func });
        return guid;
    }

    off(e: string, guid: string) {
        if (!this.queue.has(e)){
            warn("Removing nonexistent event");
            return;
        } else if (!this.queue.get(e).has(guid)) {
            warn("Removing nonexistent guid");
            return;
        }

        this.queue.get(e).delete(guid);
    }

    fire(e: string, ...args: any[]) {
        if (!this.queue.has(e)) {
            return;
        }

        this.queue.get(e).forEach((handle: EventHandle) => {
            if (!handle.check_func || handle.check_func(...args)) {
                handle.callback(...args);
            }
        });
    }
}