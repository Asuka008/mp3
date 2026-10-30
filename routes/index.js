/*
 * Connect all of your endpoints together here.
 */
module.exports = function (app, router) {
    require('./resources')(router);
    app.use('/api', require('./home.js')(router));
};
