'use strict';

const { ipcMain } = require('electron');
const { ok, fail } = require('../../src/utils/result');

module.exports = function registerEntitiesIpc(services) {
  const svc = services.schema;

  ipcMain.handle('entities:list', async (_, projectId) => {
    try { return ok(svc.listEntities(projectId)); }
    catch (e) { return fail(e.code || 'ERROR', e.message); }
  });

  ipcMain.handle('entities:get', async (_, id) => {
    try { return ok(svc.getEntity(id)); }
    catch (e) { return fail(e.code || 'ERROR', e.message); }
  });

  ipcMain.handle('entities:create', async (_, projectId, data) => {
    try { return ok(svc.createEntity(projectId, data)); }
    catch (e) { return fail(e.code || 'ERROR', e.message); }
  });

  ipcMain.handle('entities:update', async (_, id, data) => {
    try { return ok(svc.updateEntity(id, data)); }
    catch (e) { return fail(e.code || 'ERROR', e.message); }
  });

  ipcMain.handle('entities:delete', async (_, id) => {
    try { svc.deleteEntity(id); return ok(true); }
    catch (e) { return fail(e.code || 'ERROR', e.message); }
  });
};
