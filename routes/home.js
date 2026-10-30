const sendResponse = require('../utils/response');

module.exports = function (router) {
    router.get('/', (req, res) => {
        sendResponse(res, 200, 'MP3 API foundation is running.');
    });

    return router;
};
