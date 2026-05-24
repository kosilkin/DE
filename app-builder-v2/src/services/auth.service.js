'use strict';

const crypto = require('crypto');
const { ValidationError, NotFoundError, PermissionError } = require('../utils/errors');
const { now } = require('../utils/dates');

class AuthService {
  constructor(db, repos) {
    this.db = db;
    this.users = repos.users;
    this.roles = repos.roles;
  }

  _hash(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  login(projectId, login, password) {
    const user = this.users.getByLogin(projectId, login);
    if (!user) throw new NotFoundError('Неверный логин или пароль');
    if (!user.is_active) throw new PermissionError('Учётная запись отключена');
    const hash = this._hash(password);
    if (user.password_hash !== hash) throw new NotFoundError('Неверный логин или пароль');

    const role = user.role_id ? this.roles.getById(user.role_id) : null;
    return {
      id: user.id,
      login: user.login,
      full_name: user.full_name,
      role_id: user.role_id,
      role_code: role ? role.code : null,
      role_title: role ? role.title : null,
      project_id: user.project_id,
    };
  }

  me(userId) {
    const user = this.users.getById(userId);
    if (!user) throw new NotFoundError('Пользователь не найден');
    const role = user.role_id ? this.roles.getById(user.role_id) : null;
    return {
      id: user.id,
      login: user.login,
      full_name: user.full_name,
      phone: user.phone,
      email: user.email,
      role_id: user.role_id,
      role_code: role ? role.code : null,
      role_title: role ? role.title : null,
      project_id: user.project_id,
    };
  }

  register(projectId, data) {
    if (!data.login || !data.login.trim()) throw new ValidationError('Логин обязателен');
    if (!data.password || data.password.length < 3) throw new ValidationError('Пароль должен содержать минимум 3 символа');

    const existing = this.users.getByLogin(projectId, data.login);
    if (existing) throw new ValidationError('Пользователь с таким логином уже существует');

    const userRole = this.roles.getByCode(projectId, 'user');
    const ts = now();
    const user = this.users.create({
      project_id: projectId,
      login: data.login,
      password_hash: this._hash(data.password),
      full_name: data.full_name || '',
      phone: data.phone || '',
      email: data.email || '',
      role_id: userRole ? userRole.id : null,
      is_active: true,
      created_at: ts,
      updated_at: ts,
    });

    return this.me(user.id);
  }
}

module.exports = AuthService;
