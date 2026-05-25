'use strict';

const { now } = require('../utils/dates');
const { ValidationError, PermissionError, NotFoundError } = require('../utils/errors');
const { validateFieldValue } = require('../validators/fieldValidators');

class RuntimeService {
  constructor(db, repos, permissionsService) {
    this.db = db;
    this.entities = repos.entities;
    this.fields = repos.fields;
    this.permissions = repos.permissions;
    this.runtime = repos.runtime;
    this.roles = repos.roles;
    this.permSvc = permissionsService;
  }

  listEntities(ctx) {
    const entities = this.entities.listByProject(ctx.projectId);
    if (!ctx.user || !ctx.user.role_id) return entities;
    return entities.filter(e => {
      const perm = this.permissions.getTablePermission(e.id, ctx.user.role_id);
      return perm && perm.can_read;
    });
  }

  listRecords(ctx, entityId, opts = {}) {
    const entity = this.entities.getById(entityId);
    if (!entity) throw new NotFoundError('Таблица не найдена');

    this._checkAccess(entity.id, ctx, 'read');
    const scope = this._getScope(entity.id, ctx, 'read');

    const fields = this.fields.listByEntity(entityId);
    const conditions = [];
    const params = [];

    if (scope === 'own') {
      const ownerFieldId = entity.owner_field_id;
      if (ownerFieldId) {
        const ownerField = this.fields.getById(ownerFieldId);
        if (ownerField) {
          conditions.push(`${ownerField.name} = ?`);
          params.push(ctx.user.id);
        }
      }
    }

    if (opts.search && opts.search.trim()) {
      const searchFields = fields.filter(f => f.type === 'text');
      if (searchFields.length) {
        const searchConds = searchFields.map(f => `${f.name} LIKE ?`);
        conditions.push(`(${searchConds.join(' OR ')})`);
        for (const f of searchFields) params.push(`%${opts.search.trim()}%`);
      }
    }

    if (opts.filters && Array.isArray(opts.filters)) {
      for (const filter of opts.filters) {
        const field = fields.find(f => f.name === filter.field);
        if (!field) continue;
        switch (filter.op) {
          case 'eq': conditions.push(`${filter.field} = ?`); params.push(filter.value); break;
          case 'neq': conditions.push(`${filter.field} != ?`); params.push(filter.value); break;
          case 'gt': conditions.push(`${filter.field} > ?`); params.push(filter.value); break;
          case 'gte': conditions.push(`${filter.field} >= ?`); params.push(filter.value); break;
          case 'lt': conditions.push(`${filter.field} < ?`); params.push(filter.value); break;
          case 'lte': conditions.push(`${filter.field} <= ?`); params.push(filter.value); break;
          case 'like': conditions.push(`${filter.field} LIKE ?`); params.push(`%${filter.value}%`); break;
          case 'is_null': conditions.push(`${filter.field} IS NULL`); break;
          case 'not_null': conditions.push(`${filter.field} IS NOT NULL`); break;
        }
      }
    }

    const where = conditions.length ? conditions.join(' AND ') : '';
    const orderBy = opts.sortField ? `${opts.sortField} ${opts.sortDir === 'desc' ? 'DESC' : 'ASC'}` : 'id DESC';
    const page = Math.max(1, opts.page || 1);
    const pageSize = Math.min(100, Math.max(1, opts.pageSize || 25));
    const offset = (page - 1) * pageSize;

    const total = this.runtime.countRecords(entity.project_id, entity.name, { where, params });
    const records = this.runtime.listRecords(entity.project_id, entity.name, {
      where, params, orderBy, limit: pageSize, offset
    });

    return { records, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  getRecord(ctx, entityId, recordId) {
    const entity = this.entities.getById(entityId);
    if (!entity) throw new NotFoundError('Таблица не найдена');
    this._checkAccess(entity.id, ctx, 'read');

    const record = this.runtime.getRecord(entity.project_id, entity.name, recordId);
    if (!record) throw new NotFoundError('Запись не найдена');

    const scope = this._getScope(entity.id, ctx, 'read');
    if (scope === 'own') {
      this._checkOwner(entity, record, ctx);
    }

    return record;
  }

  createRecord(ctx, entityId, data) {
    const entity = this.entities.getById(entityId);
    if (!entity) throw new NotFoundError('Таблица не найдена');
    this._checkAccess(entity.id, ctx, 'create');

    const fields = this.fields.listByEntity(entityId);
    const ts = now();
    const record = { created_at: ts, updated_at: ts };

    for (const field of fields) {
      if (field.is_system || field.is_readonly) continue;
      let val = data[field.name];

      if (entity.owner_field_id === field.id && ctx.user && ctx.user.role_code !== 'admin') {
        val = ctx.user.id;
      }

      if (val === undefined || val === null || val === '') {
        if (field.default_value !== null && field.default_value !== undefined) {
          val = field.default_value;
        }
      }

      const errors = validateFieldValue(val, field);
      if (errors.length) throw new ValidationError(errors.join('; '));

      if (val !== undefined && val !== null && val !== '') {
        if (field.type === 'boolean') val = val ? 1 : 0;
        record[field.name] = val;
      }
    }

    return this.runtime.insertRecord(entity.project_id, entity.name, record);
  }

  updateRecord(ctx, entityId, recordId, data) {
    const entity = this.entities.getById(entityId);
    if (!entity) throw new NotFoundError('Таблица не найдена');
    this._checkAccess(entity.id, ctx, 'update');

    const existing = this.runtime.getRecord(entity.project_id, entity.name, recordId);
    if (!existing) throw new NotFoundError('Запись не найдена');

    const scope = this._getScope(entity.id, ctx, 'update');
    if (scope === 'own') this._checkOwner(entity, existing, ctx);

    const fields = this.fields.listByEntity(entityId);
    const ts = now();
    const updates = { updated_at: ts };

    for (const field of fields) {
      if (field.is_system || field.is_readonly) continue;
      if (data[field.name] === undefined) continue;
      let val = data[field.name];

      const errors = validateFieldValue(val, field);
      if (errors.length) throw new ValidationError(errors.join('; '));

      if (field.type === 'boolean') val = val ? 1 : 0;
      updates[field.name] = val;
    }

    return this.runtime.updateRecord(entity.project_id, entity.name, recordId, updates);
  }

  deleteRecord(ctx, entityId, recordId) {
    const entity = this.entities.getById(entityId);
    if (!entity) throw new NotFoundError('Таблица не найдена');
    this._checkAccess(entity.id, ctx, 'delete');

    const existing = this.runtime.getRecord(entity.project_id, entity.name, recordId);
    if (!existing) throw new NotFoundError('Запись не найдена');

    const scope = this._getScope(entity.id, ctx, 'delete');
    if (scope === 'own') this._checkOwner(entity, existing, ctx);

    this.runtime.deleteRecord(entity.project_id, entity.name, recordId);
  }

  deleteAllRecords(ctx, entityId) {
    const entity = this.entities.getById(entityId);
    if (!entity) throw new NotFoundError('Таблица не найдена');
    this._checkAccess(entity.id, ctx, 'delete');

    const scope = this._getScope(entity.id, ctx, 'delete');
    if (scope === 'none') throw new PermissionError('Нет доступа к удалению записей');

    if (scope === 'own') {
      const ownerField = entity.owner_field_id ? this.fields.getById(entity.owner_field_id) : null;
      if (!ownerField || !ctx.user) throw new PermissionError('Невозможно определить владельца записей');
      return this.runtime.deleteAllRecords(entity.project_id, entity.name, `${ownerField.name} = ?`, [ctx.user.id]);
    }

    return this.runtime.deleteAllRecords(entity.project_id, entity.name);
  }

  relationOptions(ctx, targetEntityId) {
    const entity = this.entities.getById(targetEntityId);
    if (!entity) return [];

    const displayField = entity.display_field_id
      ? this.fields.getById(entity.display_field_id)
      : null;

    const records = this.runtime.listRecords(entity.project_id, entity.name, {
      orderBy: 'id ASC', limit: 1000, offset: 0
    });

    return records.map(r => ({
      id: r.id,
      display: displayField ? (r[displayField.name] || `#${r.id}`) : `#${r.id}`
    }));
  }

  _checkAccess(entityId, ctx, action) {
    if (!ctx.user || !ctx.user.role_id) return;
    if (ctx.user.role_code === 'admin') return;
    const perm = this.permissions.getTablePermission(entityId, ctx.user.role_id);
    if (!perm || !perm[`can_${action}`]) {
      throw new PermissionError('Нет доступа к этому действию');
    }
  }

  _getScope(entityId, ctx, action) {
    if (!ctx.user || !ctx.user.role_id) return 'all';
    if (ctx.user.role_code === 'admin') return 'all';
    const perm = this.permissions.getTablePermission(entityId, ctx.user.role_id);
    if (!perm) return 'none';
    return perm[`${action}_scope`] || 'all';
  }

  _checkOwner(entity, record, ctx) {
    if (!entity.owner_field_id) return;
    const ownerField = this.fields.getById(entity.owner_field_id);
    if (!ownerField) return;
    if (record[ownerField.name] !== ctx.user.id) {
      throw new PermissionError('Нет доступа к чужой записи');
    }
  }
}

module.exports = RuntimeService;
