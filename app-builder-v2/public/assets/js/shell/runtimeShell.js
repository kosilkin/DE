'use strict';

const RuntimeShell = {
  async render(contentEl, sidebarEl) {
    if (!AppState.currentUser) {
      this._showLogin(contentEl, sidebarEl);
      return;
    }
    await this._renderMain(contentEl, sidebarEl);
  },

  _showLogin(contentEl, sidebarEl) {
    sidebarEl.innerHTML = '';
    DOM.hide(sidebarEl);
    contentEl.innerHTML = `
      <div style="max-width:360px;margin:60px auto">
        <div class="card">
          <div class="card-title">Вход в систему</div>
          <form id="login-form">
            <div class="form-group">
              <label>Логин</label>
              <input type="text" id="login-input" required value="Admin" />
            </div>
            <div class="form-group">
              <label>Пароль</label>
              <input type="password" id="password-input" required />
            </div>
            <div style="display:flex;gap:8px;margin-top:16px">
              <button type="submit" class="btn btn-primary">Войти</button>
              <button type="button" class="btn" data-action="runtimeRegister">Регистрация</button>
            </div>
          </form>
        </div>
      </div>
    `;
    DOM.$('#login-form', contentEl).onsubmit = async (e) => {
      e.preventDefault();
      const login = DOM.$('#login-input').value.trim();
      const password = DOM.$('#password-input').value;
      if (!login || !password) { Notifications.error('Заполните логин и пароль'); return; }
      try {
        const user = await callApi(() => api.auth.login(AppState.currentProject.id, login, password));
        AppShell.setUser(user);
        AppShell.navigate('runtime');
      } catch (err) { Notifications.error(err.message); }
    };
    Actions.scan(contentEl);
  },

  async _renderMain(contentEl, sidebarEl) {
    DOM.show(sidebarEl);
    StateViews.loading(contentEl);
    try {
      const entities = await callApi(() => api.runtime.entities(AppState.currentProject.id));
      this._renderSidebar(sidebarEl, entities);
      if (entities.length) {
        if (!AppState.currentEntityId || !entities.find(e => e.id === AppState.currentEntityId)) {
          AppState.currentEntityId = entities[0].id;
        }
        await RuntimeList.render(contentEl, AppState.currentEntityId);
      } else {
        StateViews.empty(contentEl, 'Нет доступных таблиц');
      }
    } catch (e) { StateViews.error(contentEl, e.message); }
  },

  _renderSidebar(sidebarEl, entities) {
    sidebarEl.innerHTML = `
      <div class="sidebar-section">
        <div class="sidebar-title">Таблицы</div>
        ${entities.map(e => `
          <div class="sidebar-item runtime-entity-item ${AppState.currentEntityId === e.id ? 'active' : ''}"
               data-action="runtimeSelectEntity" data-params='{"id":${e.id}}'>
            ${e.title}
          </div>
        `).join('')}
      </div>
    `;
    Actions.scan(sidebarEl);
  },
};

Actions.register('runtimeSelectEntity', async (params) => {
  AppState.currentEntityId = params.id;
  DOM.$$('.runtime-entity-item', DOM.$('#sidebar')).forEach(el => {
    try {
      const p = JSON.parse(el.dataset.params || '{}');
      el.classList.toggle('active', p.id === params.id);
    } catch {}
  });
  await RuntimeList.render(DOM.$('#main-content'), params.id);
});

Actions.register('runtimeLogout', () => {
  AppState.currentUser = null;
  AppShell.navigate('runtime');
});

Actions.register('runtimeRegister', () => {
  const overlay = DOM.el('div', { className: 'modal-overlay' });
  const modal = DOM.el('div', { className: 'modal' });
  modal.innerHTML = `
    <div class="modal-title">Регистрация</div>
    <form id="register-form">
      <div class="form-group"><label>Логин</label><input type="text" id="reg-login" required /></div>
      <div class="form-group"><label>Пароль</label><input type="password" id="reg-password" required /></div>
      <div class="form-group"><label>ФИО</label><input type="text" id="reg-fullname" /></div>
      <div class="modal-actions">
        <button type="button" class="btn" data-exempt="true" id="reg-cancel">Отмена</button>
        <button type="submit" class="btn btn-primary">Зарегистрироваться</button>
      </div>
    </form>
  `;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  DOM.$('#reg-cancel', modal).onclick = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  DOM.$('#register-form', modal).onsubmit = async (e) => {
    e.preventDefault();
    const loginVal = DOM.$('#reg-login', modal).value.trim();
    const passwordVal = DOM.$('#reg-password', modal).value;
    const fullnameVal = DOM.$('#reg-fullname', modal).value.trim();
    if (!loginVal) { Notifications.error('Заполните логин'); return; }
    if (!passwordVal) { Notifications.error('Заполните пароль'); return; }
    try {
      const user = await callApi(() => api.auth.register(AppState.currentProject.id, {
        login: loginVal,
        password: passwordVal,
        full_name: fullnameVal,
      }));
      Notifications.success('Регистрация успешна');
      overlay.remove();
      AppShell.setUser(user);
      AppShell.navigate('runtime');
    } catch (err) { Notifications.error(err.message); }
  };
});

window.RuntimeShell = RuntimeShell;
