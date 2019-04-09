/* Custom functions for interacting with the console for easier portability */
export function debug(...args: any){
    console.log('[ DEBUG ]', ...args);
}

export function log(...args: any) {
    console.log(...args);
}

export function warn(...args: any) {
    console.warn(...args);
}

export function error(...args: any) {
    //console.error(...args);
    throw args[0];
}

/* Utility functions for checking types */
export function isObj(obj) {
    if (obj !== null && typeof obj === "object" && !Array.isArray(obj)) {
        return true;
    }
    return false;
}

/* Generates a random guid */
export function make_guid() {
    function gen() {
        return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    }
    return `${gen()}${gen()}-${gen()}-${gen()}-${gen()}-${gen()}${gen()}${gen()}`;
}

/* Returns type names for most extensions of the native object type */
export function objType(obj) {
    var typeString = <string>toString.call(obj),
        typeArr = <string[]>typeString.replace(/[\[\]]/g, '').split(' ');

    if (typeArr.length > 1) {
        return typeArr[1].toLowerCase();
    }
    return "object";
}

/* Uses the objType function to verify an object is an array */
export function isArray(obj) {
    if (objType(obj) === "array") {
        return Array.isArray(obj)
    }
    return false;
}

/* A simple (albeit inefficient) way of copying JSON structures */
export function deepCopy(obj) {
    return JSON.parse(JSON.stringify(obj));
}

/* Determines the difference between all nodes of two JSON structures */
export function deep_diff(o1, o2) {
    var key, subDiff,
        diff = {};
    for (key in o1) {
        if (!o1.hasOwnProperty(key)) {
        } else if (!isObj(o1[key]) || !isObj(o2[key])) {
            if (!(key in o2) || o1[key] !== o2[key]) {
                diff[key] = o2[key];
            }
        } else {
            subDiff = deep_diff(o1[key], o2[key]);
            if (!!subDiff) {
                diff[key] = subDiff;
            }
        }
    }
    for (key in o2) {
        if (o2.hasOwnProperty(key) && !(key in o1)) {
            diff[key] = o2[key];
        }
    }
    for (key in diff) {
        if (diff.hasOwnProperty(key)) {
            return diff;
        }
    }
    return false;
}

/* Symbols */
export const STATE_CHANGED = 'stateChanged';