'use strict';

const { ipcMain, dialog } = require('electron');
const { ok, fail } = require('../../src/utils/result');
const path = require('path');
const fs = require('fs');

module.exports = function registerExportIpc(services, mainWindow) {
  const svc = services.export;

  ipcMain.handle('export:project', async (_, projectId) => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Выберите папку для экспорта',
        properties: ['openDirectory', 'createDirectory'],
      });
      if (result.canceled || !result.filePaths.length) return ok(null);
      const dir = path.join(result.filePaths[0], `project_${projectId}_export`);
      const outputDir = await svc.exportProject(projectId, dir);
      return ok(outputDir);
    } catch (e) { return fail(e.code || 'ERROR', e.message); }
  });

  ipcMain.handle('export:sql', async (_, projectId) => {
    try {
      const sql = svc.generateSql(projectId);
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Сохранить SQL',
        defaultPath: `schema_project_${projectId}.sql`,
        filters: [{ name: 'SQL', extensions: ['sql'] }],
      });
      if (result.canceled) return ok(null);
      fs.writeFileSync(result.filePath, sql);
      return ok(result.filePath);
    } catch (e) { return fail(e.code || 'ERROR', e.message); }
  });

  ipcMain.handle('export:er', async (_, projectId) => {
    try {
      const svg = svc.generateErSvg(projectId);
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Сохранить ER-диаграмму',
        defaultPath: `er_project_${projectId}.svg`,
        filters: [{ name: 'SVG', extensions: ['svg'] }],
      });
      if (result.canceled) return ok(null);
      fs.writeFileSync(result.filePath, svg);
      return ok(result.filePath);
    } catch (e) { return fail(e.code || 'ERROR', e.message); }
  });
};
