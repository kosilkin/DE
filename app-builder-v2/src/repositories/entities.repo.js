'use strict';

class EntitiesRepo {
  constructor(db) { this.db = db; }

  listByProject(projectId) {
    return this.db.prepare('SELECT * FROM entities WHERE project_id = ? ORDER BY sort_order, id').all(projectId);
  }

  getById(id) {
    return this.db.prepare('SELECT * FROM entities WHERE id = ?').get(id);
  }

  getByName(projectId, name) {
    return this.db.prepare('SELECT * FROM entities WHERE project_id = ? AND name = ?').get(projectId, name);
  }

  create(data) {
    const stmt = this.db.prepare(
      `INSERT INTO entities (project_id, name, title, description, kind, is_system, owner_field_id, display_field_id, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const info = stmt.run(
      data.project_id, data.name, data.title, data.description || '', data.kind || 'user',
      data.is_system ? 1 : 0, data.owner_field_id || null, data.display_field_id || null,
      data.sort_order || 0, data.created_at, data.updated_at
    );
    return this.getById(info.lastInsertRowid);
  }

  update(id, data) {
    const allowed = ['name', 'title', 'description', 'kind', 'owner_field_id', 'display_field_id', 'sort_order', 'updated_at'];
    const sets = [];
    const vals = [];
    for (const key of allowed) {
      if (data[key] !== undefined) { sets.push(`${key} = ?`); vals.push(data[key]); }
    }
    if (!sets.length) return this.getById(id);
    vals.push(id);
    this.db.prepare(`UPDATE entities SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    return this.getById(id);
  }

  delete(id) {
    this.db.prepare('DELETE FROM entities WHERE id = ?').run(id);
  }
}

module.exports = EntitiesRepo;
