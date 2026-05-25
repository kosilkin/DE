'use strict';

class RolesRepo {
  constructor(db) { this.db = db; }

  listByProject(projectId) {
    return this.db.prepare('SELECT * FROM roles WHERE project_id = ? ORDER BY sort_order, id').all(projectId);
  }

  getById(id) {
    return this.db.prepare('SELECT * FROM roles WHERE id = ?').get(id);
  }

  getByCode(projectId, code) {
    return this.db.prepare('SELECT * FROM roles WHERE project_id = ? AND code = ?').get(projectId, code);
  }

  create(data) {
    const stmt = this.db.prepare(
      `INSERT INTO roles (project_id, code, title, description, is_system, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const info = stmt.run(
      data.project_id, data.code, data.title, data.description || '',
      data.is_system ? 1 : 0, data.sort_order || 0, data.created_at, data.updated_at
    );
    return this.getById(info.lastInsertRowid);
  }

  update(id, data) {
    const allowed = ['code', 'title', 'description', 'sort_order', 'updated_at'];
    const sets = [];
    const vals = [];
    for (const key of allowed) {
      if (data[key] !== undefined) { sets.push(`${key} = ?`); vals.push(data[key]); }
    }
    if (!sets.length) return this.getById(id);
    vals.push(id);
    this.db.prepare(`UPDATE roles SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    return this.getById(id);
  }

  delete(id) {
    this.db.prepare('DELETE FROM roles WHERE id = ?').run(id);
  }
}

module.exports = RolesRepo;
