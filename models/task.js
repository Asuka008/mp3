const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    name: { type: String, required: true, cast: false, validate: value => value.trim().length > 0 },
    description: { type: String, default: '', cast: false },
    deadline: { type: Date, required: true },
    completed: { type: Boolean, default: false, cast: false },
    assignedUser: { type: String, default: '', cast: false, match: /^(?:[a-f\d]{24})?$/i },
    assignedUserName: { type: String, default: 'unassigned', cast: false },
    dateCreated: { type: Date, default: Date.now, immutable: true },
});

module.exports = mongoose.model('Task', taskSchema);
