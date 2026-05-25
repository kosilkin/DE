'use strict';

const { ipcMain } = require('electron');
const { ok, fail } = require('../../src/utils/result');

let _currentUser = null;
let _currentProjectId = null;

function setUser(user, projectId) {
  _currentUser = user;
  _currentProjectId = projectId;
}

function getCtx() {
  return { user: _currentUser, projectId: _currentProjectId, mode: 'desktop' };
}

module.exports = function registerRuntimeIpc(services) {
  const svc = services.runtime;

  ipcMain.handle('runtime:entities', async (_, projectId) => {
    try {
      const ctx = { ...getCtx(), projectId };
      return ok(svc.listEntities(ctx));
    } catch (e) { return fail(e.code || 'ERROR', e.message); }
  });

  ipcMain.handle('runtime:listRecords', async (_, entityId, opts) => {
    try { return ok(svc.listRecords(getCtx(), entityId, opts)); }
    catch (e) { return fail(e.code || 'ERROR', e.message); }
  });

  ipcMain.handle('runtime:getRecord', async (_, entityId, recordId) => {
    try { return ok(svc.getRecord(getCtx(), entityId, recordId)); }
    catch (e) { return fail(e.code || 'ERROR', e.message); }
  });

  ipcMain.handle('runtime:createRecord', async (_, entityId, data) => {
    try { return ok(svc.createRecord(getCtx(), entityId, data)); }
    catch (e) { return fail(e.code || 'ERROR', e.message); }
  });

  ipcMain.handle('runtime:updateRecord', async (_, entityId, recordId, data) => {
    try { return ok(svc.updateRecord(getCtx(), entityId, recordId, data)); }
    catch (e) { return fail(e.code || 'ERROR', e.message); }
  });

  ipcMain.handle('runtime:deleteRecord', async (_, entityId, recordId) => {
    try { svc.deleteRecord(getCtx(), entityId, recordId); return ok(true); }
    catch (e) { return fail(e.code || 'ERROR', e.message); }
  });

  ipcMain.handle('runtime:deleteAllRecords', async (_, entityId) => {
    try {
      const count = svc.deleteAllRecords(getCtx(), entityId);
      return ok(count);
    } catch (e) { return fail(e.code || 'ERROR', e.message); }
  });

  ipcMain.handle('runtime:relationOptions', async (_, targetEntityId) => {
    try { return ok(svc.relationOptions(getCtx(), targetEntityId)); }
    catch (e) { return fail(e.code || 'ERROR', e.message); }
  });
};

module.exports.setUser = setUser;
