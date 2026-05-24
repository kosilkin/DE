'use strict';

const { now } = require('../utils/dates');
const { ValidationError } = require('../utils/errors');

class PermissionsService {
  constructor(db, repos) {
    this.db = db;
    this.permissions = repos.permissions;
    this.entities = repos.entities;
    this.fields = repos.fields;
    this.roles = repos.roles;
  }

  getTablePermissions(entityId) {
    return this.permissions.getTablePermissionsByEntity(entityId);
  }

  saveTablePermissions(entityId, permList) {
    const ts = now();
    const results = [];
    for (const perm of permList) {
      results.push(this.permissions.saveTablePermission({
        ...perm, entity_id: entityId, created_at: ts, updated_at: ts
      }));
    }
    return results;
  }

  getFieldPermissions(entityId, roleId) {
    return this.permissions.getFieldPermissions(entityId, roleId);
  }

  saveFieldPermissions(entityId, roleId, permList) {
    const ts = now();
    for (const perm of permList) {
      this.permissions.saveFieldPermission({
        ...perm, role_id: roleId, created_at: ts, updated_at: ts
      });
    }
    return this.permissions.getFieldPermissions(entityId, roleId);
  }

  checkTableAccess(entityId, roleId, action) {
    const perm = this.permissions.getTablePermission(entityId, roleId);
    if (!perm) return { allowed: false, scope: 'none' };
    const key = `can_${action}`;
    if (!perm[key]) return { allowed: false, scope: 'none' };
    const scopeKey = `${action}_scope`;
    return { allowed: true, scope: perm[scopeKey] || 'all' };
  }

  getVisibleFields(entityId, roleId) {
    const allFields = this.fields.listByEntity(entityId);
    const perms = this.permissions.getFieldPermissions(entityId, roleId);
    const permMap = {};
    for (const p of perms) permMap[p.field_id] = p;
    return allFields.filter(f => {
      const fp = permMap[f.id];
      return !fp || fp.can_view;
    }).map(f => {
      const fp = permMap[f.id];
      return { ...f, fp: fp || { can_view: 1, can_create: 1, can_update: 1, show_in_list: 1, show_in_form: 1 } };
    });
  }
}

module.exports = PermissionsService;
