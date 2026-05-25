'use strict';

const { now } = require('../utils/dates');
const { ValidationError, NotFoundError, ConflictError } = require('../utils/errors');
const { validateName } = require('../validators/safeNames');
const crypto = require('crypto');

class ProjectsService {
  constructor(db, repos) {
    this.db = db;
    this.projects = repos.projects;
    this.roles = repos.roles;
    this.users = repos.users;
    this.entities = repos.entities;
    this.fields = repos.fields;
    this.permissions = repos.permissions;
    this.runtime = repos.runtime;
  }

  list() {
    return this.projects.list();
  }

  get(id) {
    const p = this.projects.getById(id);
    if (!p) throw new NotFoundError('Проект не найден');
    return p;
  }

  create(data) {
    if (!data.title || !data.title.trim()) throw new ValidationError('Название проекта обязательно');
    const ts = now();
    const project = this.projects.create({ ...data, created_at: ts, updated_at: ts });

    this._createDefaultRolesAndAdmin(project.id, ts);

    if (data.template_code === 'courses') {
      this._applyCoursesTemplate(project.id, ts);
    }

    return this.projects.getById(project.id);
  }

  _createDefaultRolesAndAdmin(projectId, ts) {
    const adminRole = this.roles.create({
      project_id: projectId, code: 'admin', title: 'Администратор',
      description: 'Полный доступ', is_system: true, sort_order: 0, created_at: ts, updated_at: ts
    });
    this.roles.create({
      project_id: projectId, code: 'user', title: 'Пользователь',
      description: 'Ограниченный доступ', is_system: true, sort_order: 1, created_at: ts, updated_at: ts
    });

    const hash = crypto.createHash('sha256').update('KorokNET').digest('hex');
    this.users.create({
      project_id: projectId, login: 'Admin', password_hash: hash,
      full_name: 'Администратор', role_id: adminRole.id, is_active: true,
      created_at: ts, updated_at: ts
    });
  }

  _applyCoursesTemplate(projectId, ts) {
    const adminRole = this.roles.getByCode(projectId, 'admin');
    const userRole = this.roles.getByCode(projectId, 'user');

    const coursesEntity = this._createTemplateEntity(projectId, 'courses', 'Курсы', ts);
    this._createField(coursesEntity.id, 'title', 'Название', 'text', { required: true }, ts);
    this._createField(coursesEntity.id, 'description', 'Описание', 'text', {}, ts);
    this._createField(coursesEntity.id, 'is_active', 'Активен', 'boolean', { default_value: '1' }, ts);
    const coursesTitleField = this.fields.getByName(coursesEntity.id, 'title');
    this.entities.update(coursesEntity.id, { display_field_id: coursesTitleField.id, updated_at: ts });

    const requestsEntity = this._createTemplateEntity(projectId, 'requests', 'Заявки', ts);
    this._createField(requestsEntity.id, 'start_date', 'Дата начала', 'date', {}, ts);
    this._createField(requestsEntity.id, 'payment_method', 'Способ оплаты', 'select', {
      options_json: JSON.stringify(['Наличные', 'Карта', 'Безналичный'])
    }, ts);
    this._createField(requestsEntity.id, 'status', 'Статус', 'select', {
      options_json: JSON.stringify(['Новая', 'Подтверждена', 'Оплачена', 'Отменена'])
    }, ts);
    this._createField(requestsEntity.id, 'comment', 'Комментарий', 'text', {}, ts);

    const reviewsEntity = this._createTemplateEntity(projectId, 'reviews', 'Отзывы', ts);
    this._createField(reviewsEntity.id, 'rating', 'Оценка', 'number', {
      validation_json: JSON.stringify({ min: 1, max: 5 })
    }, ts);
    this._createField(reviewsEntity.id, 'text', 'Текст', 'text', {}, ts);

    // Создать relation поля и связи
    this._createRelationField(requestsEntity.id, 'user_id', 'Пользователь', projectId, 'users', ts);
    this._createRelationField(requestsEntity.id, 'course_id', 'Курс', projectId, 'courses', ts);
    this._createRelationField(reviewsEntity.id, 'user_id', 'Пользователь', projectId, 'users', ts);
    this._createRelationField(reviewsEntity.id, 'request_id', 'Заявка', projectId, 'requests', ts);

    // permissions
    for (const entity of [coursesEntity, requestsEntity, reviewsEntity]) {
      this._createDefaultPermissions(entity.id, adminRole.id, userRole.id, ts);
    }
  }

  _createTemplateEntity(projectId, name, title, ts) {
    const entity = this.entities.create({
      project_id: projectId, name, title, kind: 'user', sort_order: 0, created_at: ts, updated_at: ts
    });
    const { sqlTypeFor } = require('../db/schema');
    this.runtime.createPhysicalTable(projectId, name, []);
    return entity;
  }

  _createField(entityId, name, title, type, extra, ts) {
    const { sqlTypeFor } = require('../db/schema');
    const field = this.fields.create({
      entity_id: entityId, name, title, type, ...extra, created_at: ts, updated_at: ts
    });
    const entity = this.entities.getById(entityId);
    this.runtime.addColumn(entity.project_id, entity.name, {
      name, sqlType: sqlTypeFor(type), defaultValue: type === 'boolean' ? '0' : undefined
    });
    return field;
  }

  _createRelationField(entityId, name, title, projectId, targetEntityName, ts) {
    const { sqlTypeFor } = require('../db/schema');
    const targetEntity = this.entities.getByName(projectId, targetEntityName);
    if (!targetEntity) return;

    const field = this.fields.create({
      entity_id: entityId, name, title, type: 'relation', created_at: ts, updated_at: ts
    });

    const entity = this.entities.getById(entityId);
    this.runtime.addColumn(entity.project_id, entity.name, {
      name, sqlType: 'INTEGER'
    });
    this.runtime.createIndex(projectId, entity.name, name, false);

    const targetDisplayField = this.db.prepare(
      'SELECT id FROM fields WHERE entity_id = ? AND sort_order = 0 ORDER BY id LIMIT 1'
    ).get(targetEntity.id);

    this.db.prepare(
      `INSERT INTO relations (source_entity_id, source_field_id, target_entity_id, target_display_field_id, on_delete_policy, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'restrict', ?, ?)`
    ).run(entityId, field.id, targetEntity.id, targetDisplayField ? targetDisplayField.id : null, ts, ts);

    return field;
  }

  _createDefaultPermissions(entityId, adminRoleId, userRoleId, ts) {
    this.permissions.saveTablePermission({
      entity_id: entityId, role_id: adminRoleId,
      can_create: 1, can_read: 1, can_update: 1, can_delete: 1, can_import: 1, can_export: 1,
      read_scope: 'all', update_scope: 'all', delete_scope: 'all',
      created_at: ts, updated_at: ts
    });
    this.permissions.saveTablePermission({
      entity_id: entityId, role_id: userRoleId,
      can_create: 1, can_read: 1, can_update: 1, can_delete: 0, can_import: 0, can_export: 1,
      read_scope: 'all', update_scope: 'own', delete_scope: 'none',
      created_at: ts, updated_at: ts
    });
  }

  update(id, data) {
    this.get(id);
    return this.projects.update(id, { ...data, updated_at: now() });
  }

  delete(id) {
    const project = this.get(id);
    const entities = this.entities.listByProject(id);
    for (const entity of entities) {
      this.runtime.dropPhysicalTable(id, entity.name);
    }
    this.projects.delete(id);
  }
}

module.exports = ProjectsService;
