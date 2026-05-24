'use strict';

const { ipcMain } = require('electron');
const { ok, fail } = require('../../src/utils/result');

module.exports = function registerAuthIpc(services) {
  const svc = services.auth;

  ipcMain.handle('auth:login', async (_, projectId, login, password) => {
    try { return ok(svc.login(projectId, login, password)); }
    catch (e) { return fail(e.code || 'ERROR', e.message); }
  });

  ipcMain.handle('auth:logout', async () => {
    return ok(true);
  });

  ipcMain.handle('auth:me', async (_, userId) => {
    try { return ok(svc.me(userId)); }
    catch (e) { return fail(e.code || 'ERROR', e.message); }
  });

  ipcMain.handle('auth:register', async (_, projectId, data) => {
    try { return ok(svc.register(projectId, data)); }
    catch (e) { return fail(e.code || 'ERROR', e.message); }
  });
};
