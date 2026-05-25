'use strict';

class UsersRepo {
  constructor(db) { this.db = db; }

  listByProject(projectId) {
    return this.db.prepare(
      `SELECT u.id, u.project_id, u.login, u.full_name, u.phone, u.email, u.role_id, u.is_active, u.created_at, u.updated_at, r.title as role_title
       FROM users u LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.project_id = ? ORDER BY u.id`
    ).all(projectId);
  }

  getById(id) {
    return this.db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  }

  getByLogin(projectId, login) {
    return this.db.prepare('SELECT * FROM users WHERE project_id = ? AND login = ?').get(projectId, login);
  }

  create(data) {
    const stmt = this.db.prepare(
      `INSERT INTO users (project_id, login, password_hash, full_name, phone, email, role_id, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const info = stmt.run(
      data.project_id, data.login, data.password_hash, data.full_name || '',
      data.phone || '', data.email || '', data.role_id || null,
      data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1,
      data.created_at, data.updated_at
    );
    return this.getById(info.lastInsertRowid);
  }

  update(id, data) {
    const allowed = ['login', 'password_hash', 'full_name', 'phone', 'email', 'role_id', 'is_active', 'updated_at'];
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
    this.db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    return this.getById(id);
  }

  delete(id) {
    this.db.prepare('DELETE FROM users WHERE id = ?').run(id);
  }
}

module.exports = UsersRepo;
