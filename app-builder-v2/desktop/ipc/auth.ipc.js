'use strict';

const { ipcMain } = require('electron');
const { ok, fail } = require('../../src/utils/result');

module.exports = function registerAuthIpc(services) {
  const svc = services.auth;

  ipcMain.handle('auth:login', async (_, projectId, login, password) => {
    try { return ok(svc.login(projectId, login, password)); }
    catch (e) { return fail(e.code || 'ERROR', e.message); }
  });

  ipcMain.handle('auth:logout', async () => {
    return ok(true);
  });

  ipcMain.handle('auth:me', async (_, userId) => {
    try { return ok(svc.me(userId)); }
    catch (e) { return fail(e.code || 'ERROR', e.message); }
  });

  ipcMain.handle('auth:register', async (_, projectId, data) => {
    try { return ok(svc.register(projectId, data)); }
    catch (e) { return fail(e.code || 'ERROR', e.message); }
  });

  // User management
  const crypto = require('crypto');
  const { now } = require('../../src/utils/dates');
  const usersRepo = services.repos.users;

  ipcMain.handle('users:list', async (_, projectId) => {
    try { return ok(usersRepo.listByProject(projectId)); }
    catch (e) { return fail('ERROR', e.message); }
  });

  ipcMain.handle('users:create', async (_, projectId, data) => {
    try {
      if (!data.login) throw new Error('Логин обязателен');
      if (!data.password || data.password.length < 3) throw new Error('Пароль минимум 3 символа');
      const existing = usersRepo.getByLogin(projectId, data.login);
      if (existing) throw new Error('Пользователь с таким логином уже существует');
      const ts = now();
      const hash = crypto.createHash('sha256').update(data.password).digest('hex');
      const user = usersRepo.create({
        project_id: projectId,
        login: data.login,
        password_hash: hash,
        full_name: data.full_name || '',
        phone: data.phone || '',
        email: data.email || '',
        role_id: data.role_id || null,
        is_active: data.is_active !== undefined ? data.is_active : true,
        created_at: ts,
        updated_at: ts,
      });
      return ok(user);
    } catch (e) { return fail(e.code || 'ERROR', e.message); }
  });

  ipcMain.handle('users:update', async (_, userId, data) => {
    try {
      const updates = { updated_at: now() };
      if (data.login !== undefined) updates.login = data.login;
      if (data.full_name !== undefined) updates.full_name = data.full_name;
      if (data.phone !== undefined) updates.phone = data.phone;
      if (data.email !== undefined) updates.email = data.email;
      if (data.role_id !== undefined) updates.role_id = data.role_id;
      if (data.is_active !== undefined) updates.is_active = data.is_active;
      if (data.password && data.password.length >= 3) {
        updates.password_hash = crypto.createHash('sha256').update(data.password).digest('hex');
      }
      return ok(usersRepo.update(userId, updates));
    } catch (e) { return fail(e.code || 'ERROR', e.message); }
  });

  ipcMain.handle('users:delete', async (_, userId) => {
    try { usersRepo.delete(userId); return ok(true); }
    catch (e) { return fail('ERROR', e.message); }
  });
};
