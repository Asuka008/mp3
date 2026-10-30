const assert = require('node:assert/strict');
const { test } = require('node:test');
const { assertFixtureInvariants } = require('../testing/invariants');

function graph() {
    return {
        users: [{ _id: 'user', name: 'Owner', pendingTasks: ['pending'] }],
        tasks: [
            { _id: 'pending', completed: false, assignedUser: 'user', assignedUserName: 'Owner' },
            { _id: 'done', completed: true, assignedUser: 'user', assignedUserName: 'Owner' },
            { _id: 'free', completed: false, assignedUser: '', assignedUserName: 'unassigned' },
        ],
    };
}

test('fixture checker accepts complete pending/completed/unassigned graphs', () => {
    const state = graph();
    assertFixtureInvariants(state.users, state.tasks);
});

test('fixture checker detects each broken reference invariant', () => {
    const mutations = [
        state => state.users[0].pendingTasks.push('pending'),
        state => state.users[0].pendingTasks.push('missing'),
        state => state.users[0].pendingTasks.push('done'),
        state => state.users[0].pendingTasks.splice(0),
        state => { state.tasks[0].assignedUser = 'missing'; },
        state => { state.tasks[0].assignedUserName = 'Stale'; },
        state => { state.tasks[2].assignedUserName = 'Wrong'; },
    ];
    for (const mutate of mutations) {
        const state = graph();
        mutate(state);
        assert.throws(() => assertFixtureInvariants(state.users, state.tasks), assert.AssertionError);
    }
});
