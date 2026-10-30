const { User, Task } = require('../models');
const { ApiError } = require('../middleware/errors');

const isId = value => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
const own = (object, key) => Object.hasOwn(object, key);

function badRequest(message) {
    throw new ApiError(400, message);
}

function requireBody(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(body))) {
        badRequest('Request body must be an object.');
    }
}

function stringField(body, key, { required = false, fallback = '' } = {}) {
    if (!own(body, key)) {
        if (required) badRequest(`${key} is required.`);
        return fallback;
    }
    const value = body[key];
    if (typeof value !== 'string' || (required && value.trim().length === 0)) {
        badRequest(`${key} must be ${required ? 'a non-empty' : 'a'} string.`);
    }
    return value;
}

function referenceId(value, field) {
    if (!isId(value)) badRequest(`${field} must contain a valid resource ID.`);
    return value.toLowerCase();
}

function deadlineValue(value) {
    if (!(value instanceof Date) && (typeof value !== 'string' || !value.trim())) {
        badRequest('deadline must be a valid date.');
    }
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) badRequest('deadline must be a valid date.');
    // Date parsing rolls some impossible ISO calendar dates into the next month.
    const calendar = typeof value === 'string' && value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T|\s|$)/);
    if (calendar) {
        const [, yearText, monthText, dayText] = calendar;
        const year = Number(yearText), month = Number(monthText), day = Number(dayText);
        const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
        const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        if (month < 1 || month > 12 || day < 1 || day > days[month - 1]) {
            badRequest('deadline must be a valid date.');
        }
    }
    return date;
}

// These builders serve POST and replacement PUT alike; they never retain old optional values.
function userPayload(body, { formEncoded = false } = {}) {
    requireBody(body);
    const name = stringField(body, 'name', { required: true });
    const email = stringField(body, 'email', { required: true });
    let pendingTasks = own(body, 'pendingTasks') ? body.pendingTasks : [];
    if (formEncoded && typeof pendingTasks === 'string') {
        try { pendingTasks = JSON.parse(pendingTasks); }
        catch { badRequest('pendingTasks must be a list of resource IDs.'); }
    }
    if (!Array.isArray(pendingTasks)) badRequest('pendingTasks must be a list of resource IDs.');
    pendingTasks = [...new Set(Array.from(pendingTasks, id => referenceId(id, 'pendingTasks')))];
    return { name, email, pendingTasks };
}

function taskPayload(body, { formEncoded = false } = {}) {
    requireBody(body);
    const name = stringField(body, 'name', { required: true });
    const deadline = deadlineValue(body.deadline);
    const description = stringField(body, 'description');
    let completed = own(body, 'completed') ? body.completed : false;
    if (formEncoded && ['true', 'false'].includes(completed)) completed = completed === 'true';
    if (typeof completed !== 'boolean') badRequest('completed must be a boolean.');
    let assignedUser = stringField(body, 'assignedUser');
    let assignedUserName = own(body, 'assignedUserName') ? stringField(body, 'assignedUserName') : undefined;
    if (assignedUser) assignedUser = referenceId(assignedUser, 'assignedUser');
    else assignedUserName = 'unassigned';
    return { name, description, deadline, completed, assignedUser, assignedUserName };
}

async function requireResource(Model, id, session) {
    const message = `${Model.modelName} not found.`;
    if (!isId(id)) throw new ApiError(404, message);
    const resource = await Model.findById(id).session(session || null);
    if (!resource) throw new ApiError(404, message);
    return resource;
}

async function prepareUserWrite(body, { id, session, formEncoded = false } = {}) {
    // URL existence wins over body errors. Loaded-reference checks follow format checks.
    const existing = id === undefined ? null : await requireResource(User, id, session);
    const payload = userPayload(body, { formEncoded });
    const emailQuery = { email: payload.email };
    if (existing) emailQuery._id = { $ne: existing._id };
    if (await User.exists(emailQuery).session(session || null)) {
        badRequest('A user with this email already exists.');
    }
    const tasks = payload.pendingTasks.length
        ? await Task.find({ _id: { $in: payload.pendingTasks } }).session(session || null)
        : [];
    if (tasks.length !== payload.pendingTasks.length) throw new ApiError(404, 'Referenced task not found.');
    if (tasks.some(task => task.completed)) badRequest('pendingTasks cannot contain completed tasks.');
    return { existing, payload, tasks };
}

async function prepareTaskWrite(body, { id, session, formEncoded = false } = {}) {
    const existing = id === undefined ? null : await requireResource(Task, id, session);
    const payload = taskPayload(body, { formEncoded });
    let user = null;
    if (payload.assignedUser) {
        user = await User.findById(payload.assignedUser).session(session || null);
        if (!user) throw new ApiError(404, 'Referenced user not found.');
        if (payload.assignedUserName !== undefined && payload.assignedUserName !== user.name) {
            badRequest('assignedUserName must match the assigned user.');
        }
        payload.assignedUserName = user.name;
    }
    return { existing, payload, user };
}

module.exports = { isId, userPayload, taskPayload, requireResource, prepareUserWrite, prepareTaskWrite };
