'use strict';

const { app, BrowserWindow, protocol } = require('electron');
const path = require('path');
const { getDb } = require('../src/db/connection');
const { runMigrations } = require('../src/db/migrate');
const { registerAllIpc } = require('./ipc/index');
const { registerAppProtocol } = require('./protocols');

const ProjectsRepo = require('../src/repositories/projects.repo');
const EntitiesRepo = require('../src/repositories/entities.repo');
const FieldsRepo = require('../src/repositories/fields.repo');
const RolesRepo = require('../src/repositories/roles.repo');
const UsersRepo = require('../src/repositories/users.repo');
const PermissionsRepo = require('../src/repositories/permissions.repo');
const RuntimeRepo = require('../src/repositories/runtime.repo');

const ProjectsService = require('../src/services/projects.service');
const SchemaService = require('../src/services/schema.service');
const AuthService = require('../src/services/auth.service');
const PermissionsService = require('../src/services/permissions.service');
const RuntimeService = require('../src/services/runtime.service');
const ImportService = require('../src/services/import.service');
const ExportService = require('../src/services/export.service');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Конструктор ИС — app-builder v2',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'public', 'index.html'));

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  registerAppProtocol();

  const db = getDb();
  const migrationResult = runMigrations(db);
  console.log(`Миграции: выполнено ${migrationResult.ran} из ${migrationResult.total}`);

  const repos = {
    projects: new ProjectsRepo(db),
    entities: new EntitiesRepo(db),
    fields: new FieldsRepo(db),
    roles: new RolesRepo(db),
    users: new UsersRepo(db),
    permissions: new PermissionsRepo(db),
    runtime: new RuntimeRepo(db),
  };

  const permissionsService = new PermissionsService(db, repos);
  const services = {
    db,
    repos,
    projects: new ProjectsService(db, repos),
    schema: new SchemaService(db, repos),
    auth: new AuthService(db, repos),
    permissions: permissionsService,
    runtime: new RuntimeService(db, repos, permissionsService),
    import: new ImportService(db, repos, permissionsService),
    export: new ExportService(db, repos),
  };

  createWindow();
  registerAllIpc(services, mainWindow);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});
