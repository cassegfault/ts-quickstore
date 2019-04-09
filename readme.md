# ts-quickstore

A Typescript based state management system.

ts-store has excellent static checking and intellisense support thanks to typescript and clever type integrations. It is a simple interface with a performant implementation using ES6 Proxies.

Features:
- **NO** dependencies
- Strong intellisense support
- Catch implementation errors at compile time
- Undo and redo built in
- Event system to watch changes to state
- Easy to use API

## Installation

```
npm install ts-quickstore
```

Alternatively, clone this repo and build from source:
```
git clone git@github.com/chris-pauley/ts-quickstore
cd ts-quickstore
npm install
npm run build
```

## Usage

ts-store uses a similar interface to VueX. The store manages a state which is modified by mutations which are called by actions. Actions and mutations are held in maps as such:

```typescript
const actions = {
    myAction({ commit, payload, dispatch }){
        // Here we can commit mutations or dispatch other actions
        // Actions may be asynchronous
        commit('myMutation', payload);
    }
};

const mutations = {
    myMutation({ state, payload }){
        // State may be modified here
        // Mutations must be synchronous and may not call other mutations
        state.someProperty = payload;
    }
}
```

A store class must be instantiated with initial state, actions, mutations, and typings for each of these.
```typescript
const myStore = new Store<typeof initialState, 
                            typeof actions, 
                            typeof mutations>({ 
                                    state: initalState, 
                                    actions, 
                                    mutations
                                });
```

Actions can be called by name and are caught by typescript if they do not exist on the actions map.
```typescript
myStore.dispatch('myAction', someObject);
// The following will throw a compile time error:
myStore.dispatch('doesNotExist', someObject);
```

Changes to the state can be watched and callbacks dispatched when changes occur
```typescript
myStore.add_observer(['todos.length'],() => { console.log('todos changed!') };
// watch specific properties of list members:
myStore.add_observer(['todos.@each.done'],() => { console.log('todo state changed!') };
```

## Development

Build and test scripts are available via npm:
```
> npm run test
> npm run build
```
Compiled JS will output to `dist/` with source maps. Feel free to make changes and submit a PR!
