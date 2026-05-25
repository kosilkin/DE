'use strict';

const { now } = require('../utils/dates');
const { ValidationError, NotFoundError, ConflictError } = require('../utils/errors');
const { validateName } = require('../validators/safeNames');
const { sqlTypeFor } = require('../db/schema');

class SchemaService {
  constructor(db, repos) {
    this.db = db;
    this.entities = repos.entities;
    this.fields = repos.fields;
    this.permissions = repos.permissions;
    this.runtime = repos.runtime;
    this.roles = repos.roles;
  }

  // --- Entities ---

  listEntities(projectId) {
    return this.entities.listByProject(projectId);
  }

  getEntity(id) {
    const e = this.entities.getById(id);
    if (!e) throw new NotFoundError('Таблица не найдена');
    return e;
  }

  createEntity(projectId, data) {
    const nameErr = validateName(data.name, 'Системное имя');
    if (nameErr) throw new ValidationError(nameErr);
    if (!data.title || !data.title.trim()) throw new ValidationError('Название таблицы обязательно');

    const existing = this.entities.getByName(projectId, data.name);
    if (existing) throw new ConflictError(`Таблица "${data.name}" уже существует`);

    const ts = now();
    const entity = this.entities.create({ ...data, project_id: projectId, created_at: ts, updated_at: ts });
    this.runtime.createPhysicalTable(projectId, data.name, []);

    const roles = this.roles.listByProject(projectId);
    for (const role of roles) {
      const isAdmin = role.code === 'admin';
      this.permissions.saveTablePermission({
        entity_id: entity.id, role_id: role.id,
        can_create: 1, can_read: 1, can_update: 1,
        can_delete: isAdmin ? 1 : 0,
        can_import: isAdmin ? 1 : 0,
        can_export: 1,
        read_scope: 'all', update_scope: isAdmin ? 'all' : 'own', delete_scope: isAdmin ? 'all' : 'none',
        created_at: ts, updated_at: ts
      });
    }

    return entity;
  }

  updateEntity(id, data) {
    this.getEntity(id);
    return this.entities.update(id, { ...data, updated_at: now() });
  }

  deleteEntity(id) {
    const entity = this.getEntity(id);
    this.runtime.dropPhysicalTable(entity.project_id, entity.name);
    this.entities.delete(id);
  }

  // --- Fields ---

  listFields(entityId) {
    return this.fields.listByEntity(entityId);
  }

  createField(entityId, data) {
    const entity = this.getEntity(entityId);
    const nameErr = validateName(data.name, 'Системное имя поля');
    if (nameErr) throw new ValidationError(nameErr);
    if (!data.title || !data.title.trim()) throw new ValidationError('Название поля обязательно');

    const existing = this.fields.getByName(entityId, data.name);
    if (existing) throw new ConflictError(`Поле "${data.name}" уже существует`);

    const ts = now();
    const field = this.fields.create({ ...data, entity_id: entityId, created_at: ts, updated_at: ts });

    this.runtime.addColumn(entity.project_id, entity.name, {
      name: data.name,
      sqlType: sqlTypeFor(data.type || 'text'),
      defaultValue: data.type === 'boolean' ? '0' : undefined
    });

    if (data.unique_value) {
      this.runtime.createIndex(entity.project_id, entity.name, data.name, true);
    }
    if (data.type === 'relation') {
      this.runtime.createIndex(entity.project_id, entity.name, data.name, false);
      if (data.target_entity_id) {
        let displayFieldId = data.target_display_field_id || null;
        if (!displayFieldId) {
          const targetDisplayField = this.db.prepare(
            'SELECT id FROM fields WHERE entity_id = ? ORDER BY sort_order, id LIMIT 1'
          ).get(data.target_entity_id);
          displayFieldId = targetDisplayField ? targetDisplayField.id : null;
        }
        this.db.prepare(
          `INSERT INTO relations (source_entity_id, source_field_id, target_entity_id, target_display_field_id, on_delete_policy, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(entityId, field.id, data.target_entity_id, displayFieldId, data.on_delete_policy || 'restrict', ts, ts);
      }
    }

    const roles = this.roles.listByProject(entity.project_id);
    for (const role of roles) {
      this.permissions.saveFieldPermission({
        field_id: field.id, role_id: role.id,
        can_view: 1, can_create: 1, can_update: 1, show_in_list: 1, show_in_form: 1,
        created_at: ts, updated_at: ts
      });
    }

    return field;
  }

  updateField(id, data) {
    const field = this.fields.getById(id);
    if (!field) throw new NotFoundError('Поле не найдено');
    return this.fields.update(id, { ...data, updated_at: now() });
  }

  deleteField(id) {
    const field = this.fields.getById(id);
    if (!field) throw new NotFoundError('Поле не найдено');
    if (field.is_system) throw new ValidationError('Системное поле нельзя удалить');
    this.db.prepare('DELETE FROM relations WHERE source_field_id = ?').run(id);
    this.fields.delete(id);
  }

  // --- Relations ---

  listRelations(projectId) {
    return this.db.prepare(
      `SELECT r.*, se.name as source_entity_name, se.title as source_entity_title,
              sf.name as source_field_name, sf.title as source_field_title,
              te.name as target_entity_name, te.title as target_entity_title,
              df.name as target_display_field_name, df.title as target_display_field_title
       FROM relations r
       JOIN entities se ON r.source_entity_id = se.id
       JOIN fields sf ON r.source_field_id = sf.id
       JOIN entities te ON r.target_entity_id = te.id
       LEFT JOIN fields df ON r.target_display_field_id = df.id
       WHERE se.project_id = ?
       ORDER BY se.sort_order, r.id`
    ).all(projectId);
  }
}

module.exports = SchemaService;
