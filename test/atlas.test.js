const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { test } = require('node:test');
const mongoose = require('mongoose');
const { User, Task, initializeModels } = require('../models');
const { prepareUserWrite, prepareTaskWrite } = require('../services/validation');
const { atomicWrite, saveReplacement } = require('../services/writes');
const { ApiError, errorHandler } = require('../middleware/errors');
const { configureTestEnvironment } = require('../testing/environment');
const { assertFixtureInvariants } = require('../testing/invariants');

test('Atlas model/index/transaction foundation; no business endpoints exercised', {
    skip: process.env.MP3_ATLAS_TESTS !== '1' ? 'Run npm run test:atlas explicitly to use Atlas.' : false,
    timeout: 45000,
}, async () => {
    const users = Array.from({ length: 5 }, () => new mongoose.Types.ObjectId());
    const tasks = [new mongoose.Types.ObjectId()];
    const email = `mp3-foundation-${randomUUID()}@example.invalid`;
    const concurrentEmail = `mp3-foundation-${randomUUID()}@example.invalid`;
    let stage = 'connection';
    mongoose.connection.on('error', () => {});
    const testEnvironment = configureTestEnvironment();
    try {
        await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
        assert.equal(mongoose.connection.db.databaseName, testEnvironment.database);
        assert.equal((await mongoose.connection.db.command({ ping: 1 })).ok, 1);
        stage = 'index initialization';
        await initializeModels();
        const indexes = await User.collection.indexes();
        assert.ok(indexes.some(index => index.unique && index.key.email === 1));

        stage = 'creation defaults and whitelists';
        const beforeCreation = Date.now();
        await atomicWrite(async session => {
            const { payload } = await prepareUserWrite({
                name: 'MP3 foundation fixture', email, dateCreated: '1900-01-01',
                _id: users[4].toString(), __v: 999,
            }, { session });
            await new User({ ...payload, _id: users[0] }).save({ session });
            const task = await prepareTaskWrite({ name: 'MP3 foundation fixture', deadline: '2000-01-01' }, { session });
            await new Task({ ...task.payload, _id: tasks[0] }).save({ session });
            return 'committed';
        });
        const user = await User.findById(users[0]).lean();
        const task = await Task.findById(tasks[0]).lean();
        assert.equal(user._id.toString(), users[0].toString());
        assert.deepEqual(user.pendingTasks, []);
        assert.ok(user.dateCreated.getTime() >= beforeCreation);
        assert.notEqual(user.__v, 999);
        assert.equal(task.description, '');
        assert.equal(task.completed, false);
        assert.equal(task.assignedUser, '');
        assert.equal(task.assignedUserName, 'unassigned');

        stage = 'actual duplicate-key enforcement';
        let duplicateError;
        try {
            // Deliberately bypass the preliminary lookup to exercise the real index.
            await atomicWrite(async session => {
                await new User({ _id: users[1], name: 'Duplicate fixture', email }).save({ session });
            });
        } catch (error) { duplicateError = error; }
        assert.equal(duplicateError?.code, 11000);
        const response = { status(value) { this.code = value; return this; }, json(value) { this.body = value; } };
        errorHandler(duplicateError, {}, response, () => assert.fail('Unexpected forwarding'));
        assert.equal(response.code, 400);
        assert.deepEqual(response.body, { message: 'A user with this email already exists.', data: null });
        assert.equal(await User.findById(users[1]), null);

        stage = 'concurrent unique email enforcement';
        // These are independent transactions/sessions, never parallel operations in one session.
        const results = await Promise.allSettled(users.slice(2, 4).map(id => atomicWrite(async session => {
            return new User({ _id: id, name: 'Concurrent fixture', email: concurrentEmail }).save({ session });
        })));
        assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
        const rejected = results.find(result => result.status === 'rejected');
        assert.equal(rejected.reason.code, 11000);
        assert.equal(await User.countDocuments({ email: concurrentEmail }), 1);

        stage = 'reference validation and error precedence';
        await assert.rejects(atomicWrite(session => prepareUserWrite({}, { id: 'bad', session })), error => error.status === 404);
        await assert.rejects(atomicWrite(session => prepareUserWrite({}, { id: users[4].toString(), session })), error => error.status === 404);
        await assert.rejects(atomicWrite(session => prepareTaskWrite({ name: 'Fixture', deadline: '2000-01-01', assignedUser: 'bad' }, { session })), error => error.status === 400);
        await assert.rejects(atomicWrite(session => prepareTaskWrite({ name: 'Fixture', deadline: '2000-01-01', assignedUser: users[4].toString() }, { session })), error => error.status === 404);
        const assigned = await atomicWrite(session => prepareTaskWrite({ name: 'Fixture', deadline: '2000-01-01', assignedUser: users[0].toString() }, { session }));
        assert.equal(assigned.payload.assignedUserName, user.name);
        assert.equal(typeof assigned.payload.assignedUser, 'string');
        await assert.rejects(atomicWrite(session => prepareTaskWrite({ name: 'Fixture', deadline: '2000-01-01', assignedUser: users[0].toString(), assignedUserName: 'Wrong' }, { session })), error => error.status === 400);

        stage = 'completed-reference validation and rollback';
        await assert.rejects(atomicWrite(async session => {
            await Task.updateOne({ _id: tasks[0] }, { $set: { completed: true } }, { session });
            await prepareUserWrite({ name: user.name, email, pendingTasks: [tasks[0].toString()] }, { id: users[0].toString(), session });
        }), error => error.status === 400);
        assert.deepEqual(await Task.findById(tasks[0]).lean(), task);

        stage = 'replacement defaults and creation-date preservation';
        await atomicWrite(async session => {
            await Task.updateOne({ _id: tasks[0] }, { $set: { description: 'Old description', completed: true } }, { session });
            const prepared = await prepareTaskWrite({ name: 'Replacement fixture', deadline: '2001-01-01', dateCreated: '1900-01-01', _id: users[4].toString() }, { id: tasks[0].toString(), session });
            await saveReplacement(prepared.existing, prepared.payload, session);
            const replacement = await prepareUserWrite({ name: 'Replacement user', email, dateCreated: '1900-01-01' }, { id: users[0].toString(), session });
            await saveReplacement(replacement.existing, replacement.payload, session);
        });
        const replacedTask = await Task.findById(tasks[0]).lean();
        const replacedUser = await User.findById(users[0]).lean();
        assert.equal(replacedTask.description, '');
        assert.equal(replacedTask.completed, false);
        assert.equal(replacedTask._id.toString(), task._id.toString());
        assert.equal(replacedTask.dateCreated.getTime(), task.dateCreated.getTime());
        assert.equal(replacedUser.dateCreated.getTime(), user.dateCreated.getTime());

        stage = 'multi-document rollback after rejected write';
        await assert.rejects(atomicWrite(async session => {
            await User.updateOne({ _id: users[0] }, { $set: { name: 'Must roll back' } }, { session });
            await Task.updateOne({ _id: tasks[0] }, { $set: { name: 'Must roll back' } }, { session });
            throw new ApiError(400, 'Injected rejection.');
        }), error => error.status === 400);
        assert.deepEqual(await User.findById(users[0]).lean(), replacedUser);
        assert.deepEqual(await Task.findById(tasks[0]).lean(), replacedTask);
        assertFixtureInvariants(await User.find({ _id: { $in: users } }).lean(), await Task.find({ _id: { $in: tasks } }).lean());
    } catch {
        throw new Error(`Atlas foundation verification failed during ${stage}; raw database details withheld.`);
    } finally {
        try {
            if (testEnvironment.matches(mongoose.connection)) {
                // Only this run's preallocated fixture IDs; never remove existing assignment data.
                await Task.deleteMany({ _id: { $in: tasks } });
                await User.deleteMany({ _id: { $in: users } });
                assert.equal(await Task.countDocuments({ _id: { $in: tasks } }), 0);
                assert.equal(await User.countDocuments({ _id: { $in: users } }), 0);
            }
        } catch {
            throw new Error('Atlas fixture cleanup failed; existing assignment records were not targeted.');
        } finally {
            await mongoose.disconnect().catch(() => {});
            testEnvironment.restore();
        }
    }
});
