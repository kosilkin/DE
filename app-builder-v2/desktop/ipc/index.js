'use strict';

const registerProjectsIpc = require('./projects.ipc');
const registerEntitiesIpc = require('./entities.ipc');
const registerFieldsIpc = require('./fields.ipc');
const registerRolesIpc = require('./roles.ipc');
const registerAuthIpc = require('./auth.ipc');
const registerPermissionsIpc = require('./permissions.ipc');
const registerRuntimeIpc = require('./runtime.ipc');
const registerImportIpc = require('./import.ipc');
const registerExportIpc = require('./export.ipc');
const registerMaintenanceIpc = require('./maintenance.ipc');

function registerAllIpc(services, mainWindow) {
  registerProjectsIpc(services);
  registerEntitiesIpc(services);
  registerFieldsIpc(services);
  registerRolesIpc(services);
  registerAuthIpc(services);
  registerPermissionsIpc(services);
  registerRuntimeIpc(services);
  registerImportIpc(services, mainWindow);
  registerExportIpc(services, mainWindow);
  registerMaintenanceIpc(services);
}

module.exports = { registerAllIpc };
