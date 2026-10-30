const express = require('express');
const { notFound, errorHandler } = require('./middleware/errors');

const app = express();

// Keep CORS headers on successful responses and errors, including preflight.
app.use((req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept');
    res.set('Access-Control-Allow-Methods', 'POST, GET, PUT, DELETE, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    next();
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

require('./routes')(app, express.Router());

app.use(notFound);
app.use(errorHandler);

// Importing the app does not load credentials, connect to a database, or listen.
module.exports = app;
