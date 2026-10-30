const { Task } = require('../models');
const { prepareUserWrite, prepareTaskWrite } = require('./validation');
const { atomicWrite, saveReplacement } = require('./writes');
const { assignPendingTasks, syncTaskMembership } = require('./references');

async function updateUser(id, body, options) {
    return atomicWrite(async session => {
        const { existing, payload, tasks } = await prepareUserWrite(body, { ...options, id, session });
        const previousPending = [...existing.pendingTasks];
        const previousName = existing.name;
        const requested = new Set(payload.pendingTasks);
        const removed = previousPending.filter(taskId => !requested.has(taskId));

        const user = await saveReplacement(existing, payload, session);
        if (removed.length) {
            // Completed tasks stay assigned even if a stale pending list happened to mention them.
            await Task.updateMany({ _id: { $in: removed }, assignedUser: user._id.toString(), completed: false }, {
                $set: { assignedUser: '', assignedUserName: 'unassigned' },
            }, { session, runValidators: true });
        }
        await assignPendingTasks(user, tasks, session);
        if (previousName !== user.name) {
            // Run after removals/transfers so every task still assigned gets the current name.
            await Task.updateMany({ assignedUser: user._id.toString() }, {
                $set: { assignedUserName: user.name },
            }, { session, runValidators: true });
        }
        return user.toObject();
    });
}

async function updateTask(id, body, options) {
    return atomicWrite(async session => {
        const { existing, payload } = await prepareTaskWrite(body, { ...options, id, session });
        const previousUser = existing.assignedUser;
        const task = await saveReplacement(existing, payload, session);
        await syncTaskMembership(task, previousUser, session);
        return task.toObject();
    });
}

module.exports = { updateUser, updateTask };
