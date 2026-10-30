const assert = require('node:assert/strict');

// Inputs must include the entire closed reference graph for this test's fixtures.
function assertFixtureInvariants(users, tasks) {
    const byUser = new Map(users.map(user => [user._id.toString(), user]));
    const byTask = new Map(tasks.map(task => [task._id.toString(), task]));
    assert.equal(byUser.size, users.length, 'Fixture user ids must be unique');
    assert.equal(byTask.size, tasks.length, 'Fixture task ids must be unique');
    const members = new Map();
    for (const user of users) {
        const id = user._id.toString();
        assert.ok(Array.isArray(user.pendingTasks), 'pendingTasks must be an array');
        assert.equal(new Set(user.pendingTasks).size, user.pendingTasks.length, 'Duplicate pending membership');
        for (const taskId of user.pendingTasks) {
            assert.equal(typeof taskId, 'string', 'Public references must stay strings');
            const task = byTask.get(taskId);
            assert.ok(task, 'Pending membership points to a missing task');
            assert.equal(task.completed, false, 'Completed tasks cannot have pending membership');
            assert.equal(task.assignedUser, id, 'Pending membership points to a different owner');
            assert.equal(task.assignedUserName, user.name, 'Task owner name is stale');
            const list = members.get(taskId) || [];
            list.push(id);
            members.set(taskId, list);
        }
    }
    for (const task of tasks) {
        const id = task._id.toString();
        const list = members.get(id) || [];
        assert.equal(typeof task.assignedUser, 'string', 'Assignment must stay a string');
        assert.equal(typeof task.completed, 'boolean', 'Completion must stay a boolean');
        if (task.assignedUser === '') {
            assert.equal(task.assignedUserName, 'unassigned', 'Unassigned pair is not canonical');
            assert.equal(list.length, 0, 'Unassigned task has pending membership');
        } else {
            const owner = byUser.get(task.assignedUser);
            assert.ok(owner, 'Assigned task points to a missing fixture owner');
            assert.equal(task.assignedUserName, owner.name, 'Assigned name does not match owner');
            assert.deepEqual(list, task.completed ? [] : [task.assignedUser], 'Pending assignment needs exactly one matching membership');
        }
    }
}

module.exports = { assertFixtureInvariants };
