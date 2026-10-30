const { User, Task } = require('../models');
const { prepareUserWrite, prepareTaskWrite } = require('./validation');
const { atomicWrite } = require('./writes');
const { assignPendingTasks, syncTaskMembership } = require('./references');

async function createUser(body, options) {
    return atomicWrite(async session => {
        const { payload, tasks } = await prepareUserWrite(body, { ...options, session });
        const user = new User(payload);
        await user.save({ session });

        await assignPendingTasks(user, tasks, session);
        return user.toObject();
    });
}

async function createTask(body, options) {
    return atomicWrite(async session => {
        const { payload } = await prepareTaskWrite(body, { ...options, session });
        const task = new Task(payload);
        await task.save({ session });
        await syncTaskMembership(task, '', session);
        return task.toObject();
    });
}

module.exports = { createUser, createTask };
