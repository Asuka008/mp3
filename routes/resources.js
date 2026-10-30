const { User, Task } = require('../models');
const { createUser, createTask } = require('../services/create');
const { updateUser, updateTask } = require('../services/update');
const { deleteUser, deleteTask } = require('../services/remove');
const { listResources, getResource } = require('../services/queries');
const sendResponse = require('../utils/response');

module.exports = function (router) {
    const resources = [['users', User, createUser, updateUser, deleteUser], ['tasks', Task, createTask, updateTask, deleteTask]];
    for (const [path, Model, create, update, remove] of resources) {
        router.post(`/${path}`, async (req, res) => {
            const data = await create(req.body, { formEncoded: Boolean(req.is('application/x-www-form-urlencoded')) });
            sendResponse(res, 201, `${Model.modelName} created.`, data);
        });
        router.get(`/${path}`, async (req, res) => {
            sendResponse(res, 200, 'OK', await listResources(Model, req.query));
        });
        router.get(`/${path}/:id`, async (req, res) => {
            sendResponse(res, 200, 'OK', await getResource(Model, req.params.id, req.query));
        });
        router.put(`/${path}/:id`, async (req, res) => {
            const data = await update(req.params.id, req.body, { formEncoded: Boolean(req.is('application/x-www-form-urlencoded')) });
            sendResponse(res, 200, `${Model.modelName} updated.`, data);
        });
        router.delete(`/${path}/:id`, async (req, res) => {
            await remove(req.params.id);
            // The official self-check requires a bodyless 204 after the transaction commits.
            res.status(204).end();
        });
    }
    return router;
};
