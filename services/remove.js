const { User, Task } = require('../models');
const { requireResource } = require('./validation');
const { atomicWrite } = require('./writes');
const { clearTaskMembership } = require('./references');

async function deleteTask(id) {
    return atomicWrite(async session => {
        const task = await requireResource(Task, id, session);
        await Task.deleteOne({ _id: task._id }, { session });
        await clearTaskMembership(task._id, [task.assignedUser], session);
        return null;
    });
}

async function deleteUser(id) {
    return atomicWrite(async session => {
        const user = await requireResource(User, id, session);
        await User.deleteOne({ _id: user._id }, { session });
        // Keep every task and all business fields, including completion and creation date.
        await Task.updateMany({ assignedUser: user._id.toString() }, {
            $set: { assignedUser: '', assignedUserName: 'unassigned' },
        }, { session, runValidators: true });
        return null;
    });
}

module.exports = { deleteUser, deleteTask };
