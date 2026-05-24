'use strict';

class ProjectsRepo {
  constructor(db) { this.db = db; }

  list() {
    return this.db.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all();
  }

  getById(id) {
    return this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  }

  create(data) {
    const stmt = this.db.prepare(
      'INSERT INTO projects (title, description, template_code, schema_version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const info = stmt.run(data.title, data.description || '', data.template_code || '', data.schema_version || 1, data.created_at, data.updated_at);
    return this.getById(info.lastInsertRowid);
  }

  update(id, data) {
    const sets = [];
    const vals = [];
    for (const key of ['title', 'description', 'template_code', 'schema_version', 'login_enabled', 'updated_at']) {
      if (data[key] !== undefined) { sets.push(`${key} = ?`); vals.push(data[key]); }
    }
    if (!sets.length) return this.getById(id);
    vals.push(id);
    this.db.prepare(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    return this.getById(id);
  }

  delete(id) {
    this.db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  }
}

module.exports = ProjectsRepo;
