const User = require('./user');
const Task = require('./task');

async function initializeModels() {
    // Wait for collections and declared indexes. Never drop indexes or conflicting records.
    await User.init();
    await Task.init();
}

module.exports = { User, Task, initializeModels };
