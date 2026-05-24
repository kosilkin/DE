'use strict';

const { physicalTableName } = require('../db/schema');

class RuntimeRepo {
  constructor(db) { this.db = db; }

  createPhysicalTable(projectId, entityName, columns) {
    const tbl = physicalTableName(projectId, entityName);
    const colDefs = columns.map(c => {
      let def = `${c.name} ${c.sqlType}`;
      if (c.notNull) def += ' NOT NULL';
      if (c.defaultValue !== undefined) def += ` DEFAULT ${c.defaultValue}`;
      return def;
    });
    const parts = ['id INTEGER PRIMARY KEY AUTOINCREMENT'];
    if (colDefs.length) parts.push(...colDefs);
    parts.push('created_at TEXT NOT NULL');
    parts.push('updated_at TEXT NOT NULL');
    const sql = `CREATE TABLE IF NOT EXISTS ${tbl} (\n      ${parts.join(',\n      ')}\n    )`;
    this.db.exec(sql);
    return tbl;
  }

  addColumn(projectId, entityName, col) {
    const tbl = physicalTableName(projectId, entityName);
    let def = `${col.name} ${col.sqlType}`;
    if (col.defaultValue !== undefined) def += ` DEFAULT ${col.defaultValue}`;
    this.db.exec(`ALTER TABLE ${tbl} ADD COLUMN ${def}`);
  }

  createIndex(projectId, entityName, fieldName, unique) {
    const tbl = physicalTableName(projectId, entityName);
    const idxName = `idx_${tbl}_${fieldName}`;
    const uniq = unique ? 'UNIQUE ' : '';
    this.db.exec(`CREATE ${uniq}INDEX IF NOT EXISTS ${idxName} ON ${tbl}(${fieldName})`);
  }

  dropPhysicalTable(projectId, entityName) {
    const tbl = physicalTableName(projectId, entityName);
    this.db.exec(`DROP TABLE IF EXISTS ${tbl}`);
  }

  listRecords(projectId, entityName, { where, params, orderBy, limit, offset }) {
    const tbl = physicalTableName(projectId, entityName);
    let sql = `SELECT * FROM ${tbl}`;
    if (where) sql += ` WHERE ${where}`;
    if (orderBy) sql += ` ORDER BY ${orderBy}`;
    if (limit) sql += ` LIMIT ${limit}`;
    if (offset) sql += ` OFFSET ${offset}`;
    return this.db.prepare(sql).all(...(params || []));
  }

  countRecords(projectId, entityName, { where, params }) {
    const tbl = physicalTableName(projectId, entityName);
    let sql = `SELECT COUNT(*) as cnt FROM ${tbl}`;
    if (where) sql += ` WHERE ${where}`;
    return this.db.prepare(sql).get(...(params || [])).cnt;
  }

  getRecord(projectId, entityName, id) {
    const tbl = physicalTableName(projectId, entityName);
    return this.db.prepare(`SELECT * FROM ${tbl} WHERE id = ?`).get(id);
  }

  insertRecord(projectId, entityName, data) {
    const tbl = physicalTableName(projectId, entityName);
    const keys = Object.keys(data);
    const placeholders = keys.map(() => '?').join(', ');
    const sql = `INSERT INTO ${tbl} (${keys.join(', ')}) VALUES (${placeholders})`;
    const info = this.db.prepare(sql).run(...keys.map(k => data[k]));
    return this.getRecord(projectId, entityName, info.lastInsertRowid);
  }

  updateRecord(projectId, entityName, id, data) {
    const tbl = physicalTableName(projectId, entityName);
    const keys = Object.keys(data);
    const sets = keys.map(k => `${k} = ?`).join(', ');
    this.db.prepare(`UPDATE ${tbl} SET ${sets} WHERE id = ?`).run(...keys.map(k => data[k]), id);
    return this.getRecord(projectId, entityName, id);
  }

  deleteRecord(projectId, entityName, id) {
    const tbl = physicalTableName(projectId, entityName);
    this.db.prepare(`DELETE FROM ${tbl} WHERE id = ?`).run(id);
  }

  tableExists(projectId, entityName) {
    const tbl = physicalTableName(projectId, entityName);
    const row = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(tbl);
    return !!row;
  }
}

module.exports = RuntimeRepo;
