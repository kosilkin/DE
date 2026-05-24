'use strict';

const fs = require('fs');
const path = require('path');
const { now } = require('../utils/dates');

function ensureMigrationsTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `);
}

function getAppliedVersions(db) {
  return db.prepare('SELECT version FROM schema_migrations ORDER BY version')
    .all()
    .map(r => r.version);
}

function loadMigrations() {
  const dir = path.join(__dirname, 'migrations');
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.js'))
    .sort();
  return files.map(f => {
    const m = require(path.join(dir, f));
    const version = parseInt(f.split('_')[0], 10);
    return { version, name: f.replace('.js', ''), up: m.up };
  });
}

function runMigrations(db) {
  ensureMigrationsTable(db);
  const applied = getAppliedVersions(db);
  const migrations = loadMigrations();
  const pending = migrations.filter(m => !applied.includes(m.version));
  for (const m of pending) {
    db.transaction(() => {
      m.up(db);
      db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)')
        .run(m.version, m.name, now());
    })();
  }
  return { applied: applied.length, ran: pending.length, total: migrations.length };
}

module.exports = { runMigrations, ensureMigrationsTable };
