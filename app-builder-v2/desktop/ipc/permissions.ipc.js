'use strict';

const { ipcMain } = require('electron');
const { ok, fail } = require('../../src/utils/result');

module.exports = function registerPermissionsIpc(services) {
  const svc = services.permissions;

  ipcMain.handle('permissions:getTable', async (_, entityId) => {
    try { return ok(svc.getTablePermissions(entityId)); }
    catch (e) { return fail(e.code || 'ERROR', e.message); }
  });

  ipcMain.handle('permissions:saveTable', async (_, entityId, perms) => {
    try { return ok(svc.saveTablePermissions(entityId, perms)); }
    catch (e) { return fail(e.code || 'ERROR', e.message); }
  });

  ipcMain.handle('permissions:getFields', async (_, entityId, roleId) => {
    try { return ok(svc.getFieldPermissions(entityId, roleId)); }
    catch (e) { return fail(e.code || 'ERROR', e.message); }
  });

  ipcMain.handle('permissions:saveFields', async (_, entityId, roleId, perms) => {
    try { return ok(svc.saveFieldPermissions(entityId, roleId, perms)); }
    catch (e) { return fail(e.code || 'ERROR', e.message); }
  });
};
