'use strict';

const { ipcMain } = require('electron');
const { ok, fail } = require('../../src/utils/result');

module.exports = function registerMaintenanceIpc(services) {
  const db = services.db;

  ipcMain.handle('maintenance:stats', async () => {
    try {
      const projects = db.prepare('SELECT COUNT(*) as cnt FROM projects').get().cnt;
      const entities = db.prepare('SELECT COUNT(*) as cnt FROM entities').get().cnt;
      const fields = db.prepare('SELECT COUNT(*) as cnt FROM fields').get().cnt;
      const users = db.prepare('SELECT COUNT(*) as cnt FROM users').get().cnt;
      const roles = db.prepare('SELECT COUNT(*) as cnt FROM roles').get().cnt;
      return ok({ projects, entities, fields, users, roles });
    } catch (e) { return fail('ERROR', e.message); }
  });
};
