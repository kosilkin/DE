'use strict';

const Database = require('better-sqlite3');
const { getDbPath } = require('../utils/paths');
const fs = require('fs');
const path = require('path');

let _db = null;

function getDb(dbPath) {
  if (_db) return _db;
  const p = dbPath || getDbPath();
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  _db = new Database(p);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  return _db;
}

function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
}

function resetDb() {
  _db = null;
}

module.exports = { getDb, closeDb, resetDb };
