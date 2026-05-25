'use strict';

const { contextBridge, ipcRenderer } = require('electron');

function invoke(channel, ...args) {
  return ipcRenderer.invoke(channel, ...args);
}

contextBridge.exposeInMainWorld('appApi', {
  projects: {
    list: () => invoke('projects:list'),
    get: (id) => invoke('projects:get', id),
    create: (data) => invoke('projects:create', data),
    update: (id, data) => invoke('projects:update', id, data),
    delete: (id) => invoke('projects:delete', id),
  },
  entities: {
    list: (projectId) => invoke('entities:list', projectId),
    get: (id) => invoke('entities:get', id),
    create: (projectId, data) => invoke('entities:create', projectId, data),
    update: (id, data) => invoke('entities:update', id, data),
    delete: (id) => invoke('entities:delete', id),
  },
  fields: {
    list: (entityId) => invoke('fields:list', entityId),
    create: (entityId, data) => invoke('fields:create', entityId, data),
    update: (id, data) => invoke('fields:update', id, data),
    delete: (id) => invoke('fields:delete', id),
  },
  relations: {
    list: (projectId) => invoke('relations:list', projectId),
  },
  roles: {
    list: (projectId) => invoke('roles:list', projectId),
    create: (projectId, data) => invoke('roles:create', projectId, data),
    update: (id, data) => invoke('roles:update', id, data),
    delete: (id) => invoke('roles:delete', id),
  },
  auth: {
    login: (projectId, login, password) => invoke('auth:login', projectId, login, password),
    logout: () => invoke('auth:logout'),
    me: (userId) => invoke('auth:me', userId),
    register: (projectId, data) => invoke('auth:register', projectId, data),
  },
  users: {
    list: (projectId) => invoke('users:list', projectId),
    create: (projectId, data) => invoke('users:create', projectId, data),
    update: (userId, data) => invoke('users:update', userId, data),
    delete: (userId) => invoke('users:delete', userId),
  },
  permissions: {
    getTable: (entityId) => invoke('permissions:getTable', entityId),
    saveTable: (entityId, perms) => invoke('permissions:saveTable', entityId, perms),
    getFields: (entityId, roleId) => invoke('permissions:getFields', entityId, roleId),
    saveFields: (entityId, roleId, perms) => invoke('permissions:saveFields', entityId, roleId, perms),
  },
  runtime: {
    entities: (projectId) => invoke('runtime:entities', projectId),
    listRecords: (entityId, opts) => invoke('runtime:listRecords', entityId, opts),
    getRecord: (entityId, recordId) => invoke('runtime:getRecord', entityId, recordId),
    createRecord: (entityId, data) => invoke('runtime:createRecord', entityId, data),
    updateRecord: (entityId, recordId, data) => invoke('runtime:updateRecord', entityId, recordId, data),
    deleteRecord: (entityId, recordId) => invoke('runtime:deleteRecord', entityId, recordId),
    deleteAllRecords: (entityId) => invoke('runtime:deleteAllRecords', entityId),
    relationOptions: (targetEntityId, displayFieldId) => invoke('runtime:relationOptions', targetEntityId, displayFieldId),
  },
  import: {
    pickExcelFile: () => invoke('import:pickExcelFile'),
    previewExcel: (filePath, opts) => invoke('import:previewExcel', filePath, opts),
    checkEntityImport: (entityId, mapping, previewData) => invoke('import:checkEntityImport', entityId, mapping, previewData),
    runEntityImport: (entityId, filePath, opts) => invoke('import:runEntityImport', entityId, filePath, opts),
    autoMapping: (headers, entityId) => invoke('import:autoMapping', headers, entityId),
  },
  export: {
    project: (projectId) => invoke('export:project', projectId),
    projectDev: (projectId) => invoke('export:projectDev', projectId),
    importProjectDev: () => invoke('export:importProjectDev'),
    sql: (projectId) => invoke('export:sql', projectId),
    er: (projectId) => invoke('export:er', projectId),
    createShortcut: () => invoke('export:createShortcut'),
  },
  maintenance: {
    stats: () => invoke('maintenance:stats'),
  },
});
