'use strict';

class PermissionsRepo {
  constructor(db) { this.db = db; }

  getTablePermission(entityId, roleId) {
    return this.db.prepare('SELECT * FROM table_permissions WHERE entity_id = ? AND role_id = ?').get(entityId, roleId);
  }

  getTablePermissionsByEntity(entityId) {
    return this.db.prepare(
      `SELECT tp.*, r.code as role_code, r.title as role_title
       FROM table_permissions tp JOIN roles r ON tp.role_id = r.id
       WHERE tp.entity_id = ? ORDER BY r.sort_order`
    ).all(entityId);
  }

  getTablePermissionsByRole(roleId) {
    return this.db.prepare(
      `SELECT tp.*, e.name as entity_name, e.title as entity_title
       FROM table_permissions tp JOIN entities e ON tp.entity_id = e.id
       WHERE tp.role_id = ? ORDER BY e.sort_order`
    ).all(roleId);
  }

  saveTablePermission(data) {
    const existing = this.getTablePermission(data.entity_id, data.role_id);
    if (existing) {
      this.db.prepare(
        `UPDATE table_permissions SET can_create=?, can_read=?, can_update=?, can_delete=?, can_import=?, can_export=?,
         read_scope=?, update_scope=?, delete_scope=?, updated_at=? WHERE id=?`
      ).run(
        data.can_create ? 1 : 0, data.can_read ? 1 : 0, data.can_update ? 1 : 0, data.can_delete ? 1 : 0,
        data.can_import ? 1 : 0, data.can_export ? 1 : 0,
        data.read_scope || 'all', data.update_scope || 'all', data.delete_scope || 'all',
        data.updated_at, existing.id
      );
      return this.getTablePermission(data.entity_id, data.role_id);
    }
    this.db.prepare(
      `INSERT INTO table_permissions (entity_id, role_id, can_create, can_read, can_update, can_delete, can_import, can_export,
       read_scope, update_scope, delete_scope, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      data.entity_id, data.role_id,
      data.can_create ? 1 : 0, data.can_read ? 1 : 0, data.can_update ? 1 : 0, data.can_delete ? 1 : 0,
      data.can_import ? 1 : 0, data.can_export ? 1 : 0,
      data.read_scope || 'all', data.update_scope || 'all', data.delete_scope || 'all',
      data.created_at, data.updated_at
    );
    return this.getTablePermission(data.entity_id, data.role_id);
  }

  getFieldPermissions(entityId, roleId) {
    return this.db.prepare(
      `SELECT fp.*, f.name as field_name, f.title as field_title
       FROM field_permissions fp JOIN fields f ON fp.field_id = f.id
       WHERE f.entity_id = ? AND fp.role_id = ? ORDER BY f.sort_order`
    ).all(entityId, roleId);
  }

  saveFieldPermission(data) {
    const existing = this.db.prepare('SELECT * FROM field_permissions WHERE field_id = ? AND role_id = ?').get(data.field_id, data.role_id);
    if (existing) {
      this.db.prepare(
        `UPDATE field_permissions SET can_view=?, can_create=?, can_update=?, show_in_list=?, show_in_form=?, mask_policy=?, updated_at=? WHERE id=?`
      ).run(
        data.can_view !== undefined ? (data.can_view ? 1 : 0) : 1,
        data.can_create !== undefined ? (data.can_create ? 1 : 0) : 1,
        data.can_update !== undefined ? (data.can_update ? 1 : 0) : 1,
        data.show_in_list !== undefined ? (data.show_in_list ? 1 : 0) : 1,
        data.show_in_form !== undefined ? (data.show_in_form ? 1 : 0) : 1,
        data.mask_policy || '', data.updated_at, existing.id
      );
      return;
    }
    this.db.prepare(
      `INSERT INTO field_permissions (field_id, role_id, can_view, can_create, can_update, show_in_list, show_in_form, mask_policy, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      data.field_id, data.role_id,
      data.can_view !== undefined ? (data.can_view ? 1 : 0) : 1,
      data.can_create !== undefined ? (data.can_create ? 1 : 0) : 1,
      data.can_update !== undefined ? (data.can_update ? 1 : 0) : 1,
      data.show_in_list !== undefined ? (data.show_in_list ? 1 : 0) : 1,
      data.show_in_form !== undefined ? (data.show_in_form ? 1 : 0) : 1,
      data.mask_policy || '', data.created_at, data.updated_at
    );
  }
}

module.exports = PermissionsRepo;
