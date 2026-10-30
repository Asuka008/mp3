const { User, Task } = require('../models');

async function assignPendingTasks(user, tasks, session) {
    if (tasks.length === 0) return;
    const userId = user._id.toString();
    const taskIds = tasks.map(task => task._id.toString());
    const previousOwners = [...new Set(tasks.map(task => task.assignedUser)
        .filter(owner => owner && owner !== userId))];
    if (previousOwners.length) {
        await User.updateMany({ _id: { $in: previousOwners } }, {
            $pull: { pendingTasks: { $in: taskIds } },
        }, { session, runValidators: true });
    }
    await Task.updateMany({ _id: { $in: taskIds } }, {
        $set: { assignedUser: userId, assignedUserName: user.name },
    }, { session, runValidators: true });
}

async function clearTaskMembership(taskId, owners, session) {
    const ownerIds = [...new Set(owners.filter(Boolean))];
    if (ownerIds.length) {
        await User.updateMany({ _id: { $in: ownerIds } }, {
            $pull: { pendingTasks: taskId.toString() },
            // Even a completed/new task must conflict with concurrent owner rename/deletion.
            // A no-op $pull alone does not serialize the owner snapshot with those writes.
            $inc: { __v: 1 },
        }, { session, runValidators: true });
    }
}

async function syncTaskMembership(task, previousUser, session) {
    const taskId = task._id.toString();
    // Clear duplicates/stale membership for both affected owners, then add once if pending.
    await clearTaskMembership(taskId, [previousUser, task.assignedUser], session);
    if (task.assignedUser && !task.completed) {
        await User.updateOne({ _id: task.assignedUser }, {
            $addToSet: { pendingTasks: taskId },
        }, { session, runValidators: true });
    }
}

module.exports = { assignPendingTasks, clearTaskMembership, syncTaskMembership };
