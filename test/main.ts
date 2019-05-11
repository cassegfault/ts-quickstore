import { expect } from "chai";
import { Store, MutationsMap, ActionsMap } from "../src/store";
import EventManager from "../src/lib/EventManager";
import { ActionFunction, MutationFunction } from "../src/lib/common";
import { make_guid, deepCopy } from "../src/lib/utils";

class TestClass {
    id: string;
    constructor(){
        this.id = make_guid();
    }
    load(json){
        this.id = json.id;
    }
}
const TestActions: ActionsMap = {
    test_action: <ActionFunction>function({ commit }){
        commit('test_mutation', {});
    },
    add_todos: <ActionFunction>function({ commit, payload }){
        var guids = [];
        payload.forEach((todo) => {
            guids.push(commit('add_todo', todo));
        });
        return guids;
    },
    clear_todos: <ActionFunction>function ({ commit }){
        commit('clear_todos', null);
    },
    update_todo: <ActionFunction>function ({ commit, payload }){
        commit('update_todo', payload);
    }
};

const TestMutations: MutationsMap = {
    test_mutation: <MutationFunction>function({ state }){
        state.test_class = new TestClass();
    },
    add_todo: <MutationFunction>function({ state, payload }){
        var guid = make_guid();
        state.todos.push(Object.assign({ __guid: guid },payload));
        return guid;
    },
    update_todo: <MutationFunction>function({ state, payload: { guid, item } }){
        for(let todo of state.todos) {
            if (todo.__guid === guid){
                todo = Object.assign(todo,item);
                break;
            }
        }
    },
    clear_todos: <MutationFunction>function({ state }){
        state.todos = [];
    }
};

const TestState = {
    test_class: null,
    todos: [],
    load(json){
        this.test_class = json.test_class;
        this.todos = json.todos;
    }
};

var TestStore: Store<typeof TestState, 
                        typeof TestActions, 
                        typeof TestMutations>;

describe('Actions and Mutations', function() {
    beforeEach(() => {
        

        /* Reset the state before each test */
        TestStore = new Store<typeof TestState, 
                            typeof TestActions, 
                            typeof TestMutations>({
                                state: Object.assign({},TestState), 
                                actions: Object.assign({}, TestActions), 
                                mutations: Object.assign({}, TestMutations)
                            });
        TestStore.dispatch('add_todos',[{ 
                                            title:'First todo', 
                                            done: false
                                        },{ 
                                            title:'Second todo', 
                                            done: true 
                                        },{ 
                                            title:'Third todo', 
                                            done: false 
                                        }]);
    });

    it('Modify state', function(){
        TestStore.dispatch('clear_todos');
        var todo_item = { title:'test todo', done: false };
        var guids = TestStore.dispatch('add_todos', [todo_item]);
        expect(TestStore.state.todos[0].title).to.eql(todo_item.title);
        expect(TestStore.state.todos[0].done).to.eql(todo_item.done);
        expect(TestStore.state.todos[0].__guid).to.eql(guids[0]);
    });

    it('Error on bad action names', function() {
        expect(()=>{
            TestStore.dispatch('bad_action_name',{});
        }).throws()
    });

    it('Error on bad mutation names', function() {
        expect(()=>{
            TestStore.commit('bad_mutation_name',{});
        }).throws()
    });

    it('Can be reverted with undo', function() {
        var initial_length = TestStore.state.todos.length;
        TestStore.dispatch('clear_todos');
        expect(TestStore.state.todos.length).equals(0);
        TestStore.undo();
        expect(TestStore.state.todos.length).equals(initial_length);
    });

    it('Can be reverted with undo', function() {
        var initial_length = TestStore.state.todos.length;
        TestStore.dispatch('clear_todos');
        expect(TestStore.state.todos.length).equals(0);
        TestStore.undo();
        expect(TestStore.state.todos.length).equals(initial_length);
        TestStore.redo();
        expect(TestStore.state.todos.length).equals(0);
    });

    it('Batches updates', function() {
        // Note the current state
        var initial_length = TestStore.state.todos.length;

        // Note that a group of updates will occur
        TestStore.will_update(['todos']);

        // Enact a group of updates
        var guids = TestStore.dispatch('add_todos', [{ title:'new todo', done: false }, { title:'final todo', done: false }]);
        TestStore.dispatch('update_todo', {guid: guids[0], item:{ done: true }} );
        TestStore.dispatch('add_todos', [{ title:'new todo', done: false }]);

        // Mark the group of updates as completed
        TestStore.did_update(['todos']);

        // Note the current state
        var new_length = TestStore.state.todos.length;
        expect(new_length).not.equal(initial_length);

        // Undo the group of actions
        TestStore.undo();

        expect(TestStore.state.todos.length).equals(initial_length);
    });
});

describe('Event Manager', function() {
    var em: EventManager;
    before(() => {
        em = new EventManager();
    });

    it('Subscribes to events', () => {
        var callback_fired = false;
        em.on('test_event',()=>{ callback_fired = true; });
        em.fire('test_event');
        expect(callback_fired).equals(true);
    });

    it('Unsubscribes from events', () => {
        var callbacks_fired = 0,
            event_name = 'test_event',
            guid1 = em.on(event_name,()=>{ callbacks_fired = 1; }),
            guid2 = em.on(event_name,()=>{ callbacks_fired = 2; });
        
        em.off(event_name, guid2);
        em.fire(event_name);
        expect(callbacks_fired).equals(1);

        callbacks_fired = 0;
        em.off(event_name, guid1);
        em.fire(event_name);
        expect(callbacks_fired).equals(0);
    });
});

describe('State Consistency', function() {
    it('Maintains types', async function(){
        TestStore.dispatch('test_action');
        expect(TestStore.state.test_class).instanceOf(TestClass);
    });
});