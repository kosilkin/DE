'use strict';

const { ipcMain } = require('electron');
const { ok, fail } = require('../../src/utils/result');

module.exports = function registerFieldsIpc(services) {
  const svc = services.schema;

  ipcMain.handle('fields:list', async (_, entityId) => {
    try { return ok(svc.listFields(entityId)); }
    catch (e) { return fail(e.code || 'ERROR', e.message); }
  });

  ipcMain.handle('fields:create', async (_, entityId, data) => {
    try { return ok(svc.createField(entityId, data)); }
    catch (e) { return fail(e.code || 'ERROR', e.message); }
  });

  ipcMain.handle('fields:update', async (_, id, data) => {
    try { return ok(svc.updateField(id, data)); }
    catch (e) { return fail(e.code || 'ERROR', e.message); }
  });

  ipcMain.handle('fields:delete', async (_, id) => {
    try { svc.deleteField(id); return ok(true); }
    catch (e) { return fail(e.code || 'ERROR', e.message); }
  });
};
