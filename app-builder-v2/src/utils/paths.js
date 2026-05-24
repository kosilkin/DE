'use strict';

const path = require('path');

let _electron;
try { _electron = require('electron'); } catch { _electron = null; }

function getAppDataPath() {
  if (_electron && _electron.app) {
    return _electron.app.getPath('userData');
  }
  return process.env.APP_DATA_PATH || path.join(process.cwd(), 'data');
}

function getDbPath() {
  return path.join(getAppDataPath(), 'appbuilder.db');
}

module.exports = { getAppDataPath, getDbPath };
