'use strict';

const AccessScreen = {
  async render(container) {
    const projectId = AppState.currentProject.id;
    StateViews.loading(container);
    try {
      const roles = await callApi(() => api.roles.list(projectId));
      const entities = await callApi(() => api.entities.list(projectId));
      this._renderMain(container, roles, entities);
    } catch (e) { StateViews.error(container, e.message); }
  },

  async _renderMain(container, roles, entities) {
    const esc = (s) => { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; };
    const projectId = AppState.currentProject.id;
    let users = [];
    try { users = await callApi(() => api.users.list(projectId)); } catch {}

    let html = `
      <h2>Доступ</h2>
      <div class="toolbar" style="margin-top:16px">
        <h4>Роли</h4>
        <span class="toolbar-spacer"></span>
        <button class="btn btn-primary btn-sm" data-action="createRole">Создать роль</button>
      </div>
    `;

    html += '<div style="margin-bottom:24px">';
    for (const role of roles) {
      html += `
        <div class="entity-list-item">
          <span class="eli-title">${esc(role.title)}</span>
          <span class="eli-meta">${role.code}</span>
          ${role.is_system ? '<span class="badge badge-warning">системная</span>' : `
            <button class="btn btn-sm" data-action="editRole" data-params='{"id":${role.id}}'>Изменить</button>
            <button class="btn btn-sm btn-danger" data-action="deleteRole" data-params='{"id":${role.id}}'>Удалить</button>
          `}
        </div>
      `;
    }
    html += '</div>';

    // Users section
    html += `
      <div class="toolbar">
        <h4>Пользователи</h4>
        <span class="toolbar-spacer"></span>
        <button class="btn btn-primary btn-sm" data-action="createUser">Создать пользователя</button>
      </div>
    `;
    if (users.length) {
      html += '<table class="perm-table" style="margin-bottom:24px"><thead><tr><th>Логин</th><th>Полное имя</th><th>Роль</th><th>Активен</th><th></th></tr></thead><tbody>';
      for (const u of users) {
        html += `<tr>
          <td>${esc(u.login)}</td>
          <td>${esc(u.full_name || '')}</td>
          <td>${esc(u.role_title || '—')}</td>
          <td>${u.is_active ? 'Да' : 'Нет'}</td>
          <td>
            <button class="btn btn-sm" data-action="editUser" data-params='{"id":${u.id}}'>Изменить</button>
            <button class="btn btn-sm btn-danger" data-action="deleteUser" data-params='{"id":${u.id}}'>Удалить</button>
          </td>
        </tr>`;
      }
      html += '</tbody></table>';
    } else {
      html += '<p style="color:var(--text-secondary);margin-bottom:24px">Нет пользователей</p>';
    }

    if (entities.length && roles.length) {
      html += '<h4 style="margin-bottom:12px">Права таблиц</h4>';
      for (const entity of entities) {
        html += `
          <div class="card" style="margin-bottom:12px">
            <div class="card-title">${esc(entity.title)}</div>
            <div id="perm-table-${entity.id}"><div class="loading-state">Загрузка...</div></div>
          </div>
        `;
      }
    }

    container.innerHTML = html;

    for (const entity of entities) {
      this._loadTablePermissions(entity.id, roles);
    }
  },

  async _loadTablePermissions(entityId, roles) {
    const el = DOM.$(`#perm-table-${entityId}`);
    if (!el) return;
    try {
      const perms = await callApi(() => api.permissions.getTable(entityId));
      const permMap = {};
      for (const p of perms) permMap[p.role_id] = p;

      let html = '<table class="perm-table"><thead><tr><th>Роль</th><th>Чтение</th><th>Создание</th><th>Изменение</th><th>Удаление</th><th>Импорт</th><th>Экспорт</th><th>Чтение scope</th><th>Изменение scope</th><th>Удаление scope</th><th></th></tr></thead><tbody>';
      for (const role of roles) {
        const p = permMap[role.id] || {};
        html += `<tr data-role-id="${role.id}" data-entity-id="${entityId}">
          <td>${role.title}</td>
          <td><input type="checkbox" data-perm="can_read" ${p.can_read ? 'checked' : ''} data-exempt="true" /></td>
          <td><input type="checkbox" data-perm="can_create" ${p.can_create ? 'checked' : ''} data-exempt="true" /></td>
          <td><input type="checkbox" data-perm="can_update" ${p.can_update ? 'checked' : ''} data-exempt="true" /></td>
          <td><input type="checkbox" data-perm="can_delete" ${p.can_delete ? 'checked' : ''} data-exempt="true" /></td>
          <td><input type="checkbox" data-perm="can_import" ${p.can_import ? 'checked' : ''} data-exempt="true" /></td>
          <td><input type="checkbox" data-perm="can_export" ${p.can_export ? 'checked' : ''} data-exempt="true" /></td>
          <td><select data-perm="read_scope" data-exempt="true"><option value="all" ${p.read_scope === 'all' ? 'selected' : ''}>все</option><option value="own" ${p.read_scope === 'own' ? 'selected' : ''}>свои</option><option value="none" ${p.read_scope === 'none' ? 'selected' : ''}>нет</option></select></td>
          <td><select data-perm="update_scope" data-exempt="true"><option value="all" ${p.update_scope === 'all' ? 'selected' : ''}>все</option><option value="own" ${p.update_scope === 'own' ? 'selected' : ''}>свои</option><option value="none" ${p.update_scope === 'none' ? 'selected' : ''}>нет</option></select></td>
          <td><select data-perm="delete_scope" data-exempt="true"><option value="all" ${p.delete_scope === 'all' ? 'selected' : ''}>все</option><option value="own" ${p.delete_scope === 'own' ? 'selected' : ''}>свои</option><option value="none" ${p.delete_scope === 'none' ? 'selected' : ''}>нет</option></select></td>
          <td><button class="btn btn-sm" data-action="saveTablePerm" data-params='{"entityId":${entityId},"roleId":${role.id}}'>Сохранить</button></td>
        </tr>`;
      }
      html += '</tbody></table>';
      el.innerHTML = html;
      Actions.scan(el);
    } catch (e) { el.innerHTML = `<span style="color:var(--danger)">${e.message}</span>`; }
  },
};

Actions.register('createRole', () => {
  const overlay = DOM.el('div', { className: 'modal-overlay' });
  const modal = DOM.el('div', { className: 'modal' });
  modal.innerHTML = `
    <div class="modal-title">Создать роль</div>
    <div class="form-group"><label>Код (латиница)</label><input type="text" id="role-code" placeholder="manager" /></div>
    <div class="form-group"><label>Название</label><input type="text" id="role-title" placeholder="Менеджер" /></div>
    <div class="form-group"><label>Описание</label><textarea id="role-desc"></textarea></div>
    <div class="modal-actions">
      <button class="btn" data-exempt="true" id="modal-cancel">Отмена</button>
      <button class="btn btn-primary" data-exempt="true" id="modal-save">Создать</button>
    </div>
  `;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  DOM.$('#modal-cancel', modal).onclick = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  DOM.$('#modal-save', modal).onclick = async () => {
    try {
      await callApi(() => api.roles.create(AppState.currentProject.id, {
        code: DOM.$('#role-code', modal).value.trim(),
        title: DOM.$('#role-title', modal).value.trim(),
        description: DOM.$('#role-desc', modal).value.trim(),
      }));
      Notifications.success('Роль создана');
      overlay.remove();
      AccessScreen.render(DOM.$('#main-content'));
    } catch (e) { Notifications.error(e.message); }
  };
});

Actions.register('editRole', async (params) => {
  const roles = await callApi(() => api.roles.list(AppState.currentProject.id));
  const role = roles.find(r => r.id === params.id);
  if (!role) return;
  const overlay = DOM.el('div', { className: 'modal-overlay' });
  const modal = DOM.el('div', { className: 'modal' });
  const esc = (s) => { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; };
  modal.innerHTML = `
    <div class="modal-title">Редактировать роль</div>
    <div class="form-group"><label>Название</label><input type="text" id="role-title" value="${esc(role.title)}" /></div>
    <div class="form-group"><label>Описание</label><textarea id="role-desc">${esc(role.description || '')}</textarea></div>
    <div class="modal-actions">
      <button class="btn" data-exempt="true" id="modal-cancel">Отмена</button>
      <button class="btn btn-primary" data-exempt="true" id="modal-save">Сохранить</button>
    </div>
  `;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  DOM.$('#modal-cancel', modal).onclick = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  DOM.$('#modal-save', modal).onclick = async () => {
    try {
      await callApi(() => api.roles.update(role.id, {
        title: DOM.$('#role-title', modal).value.trim(),
        description: DOM.$('#role-desc', modal).value.trim(),
      }));
      Notifications.success('Роль обновлена');
      overlay.remove();
      AccessScreen.render(DOM.$('#main-content'));
    } catch (e) { Notifications.error(e.message); }
  };
});

Actions.register('deleteRole', async (params) => {
  if (!confirm('Удалить роль?')) return;
  try {
    await callApi(() => api.roles.delete(params.id));
    Notifications.success('Роль удалена');
    AccessScreen.render(DOM.$('#main-content'));
  } catch (e) { Notifications.error(e.message); }
});

Actions.register('createUser', async () => {
  const projectId = AppState.currentProject.id;
  const roles = await callApi(() => api.roles.list(projectId));
  const esc = (s) => { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; };
  const overlay = DOM.el('div', { className: 'modal-overlay' });
  const modal = DOM.el('div', { className: 'modal' });
  modal.innerHTML = `
    <div class="modal-title">Создать пользователя</div>
    <div class="form-group"><label>Логин</label><input type="text" id="user-login" /></div>
    <div class="form-group"><label>Пароль</label><input type="password" id="user-password" /></div>
    <div class="form-group"><label>Полное имя</label><input type="text" id="user-fullname" /></div>
    <div class="form-group"><label>Email</label><input type="email" id="user-email" /></div>
    <div class="form-group"><label>Телефон</label><input type="text" id="user-phone" /></div>
    <div class="form-group"><label>Роль</label><select id="user-role" data-exempt="true"><option value="">— без роли —</option>${roles.map(r => `<option value="${r.id}">${esc(r.title)}</option>`).join('')}</select></div>
    <div class="modal-actions">
      <button class="btn" data-exempt="true" id="modal-cancel">Отмена</button>
      <button class="btn btn-primary" data-exempt="true" id="modal-save">Создать</button>
    </div>
  `;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  DOM.$('#modal-cancel', modal).onclick = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  DOM.$('#modal-save', modal).onclick = async () => {
    try {
      await callApi(() => api.users.create(projectId, {
        login: DOM.$('#user-login', modal).value.trim(),
        password: DOM.$('#user-password', modal).value,
        full_name: DOM.$('#user-fullname', modal).value.trim(),
        email: DOM.$('#user-email', modal).value.trim(),
        phone: DOM.$('#user-phone', modal).value.trim(),
        role_id: DOM.$('#user-role', modal).value ? parseInt(DOM.$('#user-role', modal).value) : null,
      }));
      Notifications.success('Пользователь создан');
      overlay.remove();
      AccessScreen.render(DOM.$('#main-content'));
    } catch (e) { Notifications.error(e.message); }
  };
});

Actions.register('editUser', async (params) => {
  const projectId = AppState.currentProject.id;
  const users = await callApi(() => api.users.list(projectId));
  const user = users.find(u => u.id === params.id);
  if (!user) return;
  const roles = await callApi(() => api.roles.list(projectId));
  const esc = (s) => { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; };
  const overlay = DOM.el('div', { className: 'modal-overlay' });
  const modal = DOM.el('div', { className: 'modal' });
  modal.innerHTML = `
    <div class="modal-title">Редактировать пользователя</div>
    <div class="form-group"><label>Логин</label><input type="text" id="user-login" value="${esc(user.login)}" /></div>
    <div class="form-group"><label>Новый пароль (оставьте пустым)</label><input type="password" id="user-password" /></div>
    <div class="form-group"><label>Полное имя</label><input type="text" id="user-fullname" value="${esc(user.full_name || '')}" /></div>
    <div class="form-group"><label>Email</label><input type="email" id="user-email" value="${esc(user.email || '')}" /></div>
    <div class="form-group"><label>Телефон</label><input type="text" id="user-phone" value="${esc(user.phone || '')}" /></div>
    <div class="form-group"><label>Роль</label><select id="user-role" data-exempt="true"><option value="">— без роли —</option>${roles.map(r => `<option value="${r.id}" ${user.role_id === r.id ? 'selected' : ''}>${esc(r.title)}</option>`).join('')}</select></div>
    <div class="form-group"><label><input type="checkbox" id="user-active" data-exempt="true" ${user.is_active ? 'checked' : ''} /> Активен</label></div>
    <div class="modal-actions">
      <button class="btn" data-exempt="true" id="modal-cancel">Отмена</button>
      <button class="btn btn-primary" data-exempt="true" id="modal-save">Сохранить</button>
    </div>
  `;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  DOM.$('#modal-cancel', modal).onclick = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  DOM.$('#modal-save', modal).onclick = async () => {
    try {
      const data = {
        login: DOM.$('#user-login', modal).value.trim(),
        full_name: DOM.$('#user-fullname', modal).value.trim(),
        email: DOM.$('#user-email', modal).value.trim(),
        phone: DOM.$('#user-phone', modal).value.trim(),
        role_id: DOM.$('#user-role', modal).value ? parseInt(DOM.$('#user-role', modal).value) : null,
        is_active: DOM.$('#user-active', modal).checked,
      };
      const pwd = DOM.$('#user-password', modal).value;
      if (pwd) data.password = pwd;
      await callApi(() => api.users.update(user.id, data));
      Notifications.success('Пользователь обновлён');
      overlay.remove();
      AccessScreen.render(DOM.$('#main-content'));
    } catch (e) { Notifications.error(e.message); }
  };
});

Actions.register('deleteUser', async (params) => {
  if (!confirm('Удалить пользователя?')) return;
  try {
    await callApi(() => api.users.delete(params.id));
    Notifications.success('Пользователь удалён');
    AccessScreen.render(DOM.$('#main-content'));
  } catch (e) { Notifications.error(e.message); }
});

Actions.register('saveTablePerm', async (params) => {
  const row = document.querySelector(`tr[data-role-id="${params.roleId}"][data-entity-id="${params.entityId}"]`);
  if (!row) return;
  const perm = { role_id: params.roleId };
  row.querySelectorAll('[data-perm]').forEach(el => {
    const key = el.dataset.perm;
    perm[key] = el.type === 'checkbox' ? el.checked : el.value;
  });
  try {
    await callApi(() => api.permissions.saveTable(params.entityId, [perm]));
    Notifications.success('Права сохранены');
  } catch (e) { Notifications.error(e.message); }
});

window.AccessScreen = AccessScreen;
