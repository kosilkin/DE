'use strict';

const { ipcMain } = require('electron');
const { ok, fail } = require('../../src/utils/result');
const { now } = require('../../src/utils/dates');

module.exports = function registerRolesIpc(services) {
  const roles = services.repos.roles;

  ipcMain.handle('roles:list', async (_, projectId) => {
    try { return ok(roles.listByProject(projectId)); }
    catch (e) { return fail(e.code || 'ERROR', e.message); }
  });

  ipcMain.handle('roles:create', async (_, projectId, data) => {
    try {
      const ts = now();
      return ok(roles.create({ ...data, project_id: projectId, created_at: ts, updated_at: ts }));
    } catch (e) { return fail(e.code || 'ERROR', e.message); }
  });

  ipcMain.handle('roles:update', async (_, id, data) => {
    try { return ok(roles.update(id, { ...data, updated_at: now() })); }
    catch (e) { return fail(e.code || 'ERROR', e.message); }
  });

  ipcMain.handle('roles:delete', async (_, id) => {
    try { roles.delete(id); return ok(true); }
    catch (e) { return fail(e.code || 'ERROR', e.message); }
  });
};
