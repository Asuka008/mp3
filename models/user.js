const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true, cast: false, validate: value => value.trim().length > 0 },
    email: { type: String, required: true, unique: true, cast: false, validate: value => value.trim().length > 0 },
    pendingTasks: {
        type: [{ type: String, cast: false, match: /^[a-f\d]{24}$/i }],
        default: [],
        castNonArrays: false,
    },
    dateCreated: { type: Date, default: Date.now, immutable: true },
});

module.exports = mongoose.model('User', userSchema);
