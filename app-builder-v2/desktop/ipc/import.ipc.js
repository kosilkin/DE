'use strict';

const { ipcMain, dialog } = require('electron');
const { ok, fail } = require('../../src/utils/result');

module.exports = function registerImportIpc(services, mainWindow) {
  const svc = services.import;
  const runtimeIpc = require('./runtime.ipc');

  ipcMain.handle('import:pickExcelFile', async () => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Выберите файл Excel',
        filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }],
        properties: ['openFile'],
      });
      if (result.canceled || !result.filePaths.length) return ok(null);
      return ok(result.filePaths[0]);
    } catch (e) { return fail('ERROR', e.message); }
  });

  ipcMain.handle('import:previewExcel', async (_, filePath, opts) => {
    try { return ok(svc.previewExcel(filePath, opts)); }
    catch (e) { return fail(e.code || 'ERROR', e.message); }
  });

  ipcMain.handle('import:checkEntityImport', async (_, entityId, mapping, previewData) => {
    try { return ok(svc.checkEntityImport(entityId, mapping, previewData)); }
    catch (e) { return fail(e.code || 'ERROR', e.message); }
  });

  ipcMain.handle('import:runEntityImport', async (_, entityId, filePath, opts) => {
    try {
      const ctx = { user: null, mode: 'desktop' };
      return ok(svc.runEntityImport(ctx, entityId, filePath, opts));
    } catch (e) { return fail(e.code || 'ERROR', e.message); }
  });

  ipcMain.handle('import:autoMapping', async (_, headers, entityId) => {
    try { return ok(svc.autoMapping(headers, entityId)); }
    catch (e) { return fail(e.code || 'ERROR', e.message); }
  });
};
