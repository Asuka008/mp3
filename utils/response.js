function sendResponse(res, status, message, data = null) {
    if (status === 204) {
        return res.status(status).end();
    }

    return res.status(status).json({ message, data });
}

module.exports = sendResponse;
