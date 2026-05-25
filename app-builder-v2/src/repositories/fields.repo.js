'use strict';

class FieldsRepo {
  constructor(db) { this.db = db; }

  listByEntity(entityId) {
    return this.db.prepare('SELECT * FROM fields WHERE entity_id = ? ORDER BY sort_order, id').all(entityId);
  }

  getById(id) {
    return this.db.prepare('SELECT * FROM fields WHERE id = ?').get(id);
  }

  getByName(entityId, name) {
    return this.db.prepare('SELECT * FROM fields WHERE entity_id = ? AND name = ?').get(entityId, name);
  }

  create(data) {
    const stmt = this.db.prepare(
      `INSERT INTO fields (entity_id, name, title, type, required, unique_value, default_value, options_json, validation_json, is_system, is_readonly, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const info = stmt.run(
      data.entity_id, data.name, data.title, data.type || 'text',
      data.required ? 1 : 0, data.unique_value ? 1 : 0,
      data.default_value || null, data.options_json || null, data.validation_json || null,
      data.is_system ? 1 : 0, data.is_readonly ? 1 : 0,
      data.sort_order || 0, data.created_at, data.updated_at
    );
    return this.getById(info.lastInsertRowid);
  }

  update(id, data) {
    const allowed = ['name', 'title', 'type', 'required', 'unique_value', 'default_value', 'options_json', 'validation_json', 'sort_order', 'updated_at'];
    const sets = [];
    const vals = [];
    for (const key of allowed) {
      if (data[key] !== undefined) {
        sets.push(`${key} = ?`);
        vals.push(typeof data[key] === 'boolean' ? (data[key] ? 1 : 0) : data[key]);
      }
    }
    if (!sets.length) return this.getById(id);
    vals.push(id);
    this.db.prepare(`UPDATE fields SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    return this.getById(id);
  }

  delete(id) {
    this.db.prepare('DELETE FROM fields WHERE id = ?').run(id);
  }
}

module.exports = FieldsRepo;
