'use strict';

const { ipcMain } = require('electron');
const { ok, fail } = require('../../src/utils/result');

module.exports = function registerProjectsIpc(services) {
  const svc = services.projects;

  ipcMain.handle('projects:list', async () => {
    try { return ok(svc.list()); }
    catch (e) { return fail(e.code || 'ERROR', e.message); }
  });

  ipcMain.handle('projects:get', async (_, id) => {
    try { return ok(svc.get(id)); }
    catch (e) { return fail(e.code || 'ERROR', e.message); }
  });

  ipcMain.handle('projects:create', async (_, data) => {
    try { return ok(svc.create(data)); }
    catch (e) { return fail(e.code || 'ERROR', e.message); }
  });

  ipcMain.handle('projects:update', async (_, id, data) => {
    try { return ok(svc.update(id, data)); }
    catch (e) { return fail(e.code || 'ERROR', e.message); }
  });

  ipcMain.handle('projects:delete', async (_, id) => {
    try { svc.delete(id); return ok(true); }
    catch (e) { return fail(e.code || 'ERROR', e.message); }
  });
};
