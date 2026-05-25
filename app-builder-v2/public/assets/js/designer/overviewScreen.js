'use strict';

const OverviewScreen = {
  async render(container) {
    const p = AppState.currentProject;
    StateViews.loading(container);
    try {
      const entities = await callApi(() => api.entities.list(p.id));
      const roles = await callApi(() => api.roles.list(p.id));
      const stats = await callApi(() => api.maintenance.stats());

      container.innerHTML = `
        <h2>Обзор проекта: ${this._esc(p.title)}</h2>
        <p style="color:var(--text-secondary);margin:8px 0 20px">${this._esc(p.description || '')}</p>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-bottom:24px">
          <div class="card"><div class="card-title">${entities.length}</div><div style="color:var(--text-secondary)">Таблиц</div></div>
          <div class="card"><div class="card-title">${stats.fields || 0}</div><div style="color:var(--text-secondary)">Полей</div></div>
          <div class="card"><div class="card-title">${roles.length}</div><div style="color:var(--text-secondary)">Ролей</div></div>
          <div class="card"><div class="card-title">${stats.users || 0}</div><div style="color:var(--text-secondary)">Пользователей</div></div>
        </div>
        <h3 style="margin-bottom:12px">Настройки</h3>
        <div class="card" style="margin-bottom:24px">
          <div style="display:flex;align-items:center;gap:8px">
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
              <input type="checkbox" id="login-enabled-toggle" data-exempt="true" ${p.login_enabled !== 0 ? 'checked' : ''} />
              Система логина
            </label>
            <span style="color:var(--text-secondary);font-size:0.85em">(${p.login_enabled !== 0 ? 'включена — пользователи должны входить' : 'выключена — автоматический вход как Admin'})</span>
          </div>
        </div>
        <h3 style="margin-bottom:12px">Таблицы</h3>
        ${entities.length ? entities.map(e => `
          <div class="entity-list-item" data-action="designerTab" data-params='{"tab":"structure"}'>
            <span class="eli-title">${this._esc(e.title)}</span>
            <span class="eli-meta">${e.name}</span>
          </div>
        `).join('') : '<p style="color:var(--text-secondary)">Таблицы не созданы</p>'}
      `;

      const loginToggle = DOM.$('#login-enabled-toggle', container);
      if (loginToggle) {
        loginToggle.onchange = async () => {
          const val = loginToggle.checked ? 1 : 0;
          try {
            const updated = await callApi(() => api.projects.update(p.id, { login_enabled: val }));
            AppState.currentProject = updated;
            Notifications.success(val ? 'Система логина включена' : 'Система логина выключена');
            OverviewScreen.render(container);
          } catch (err) { Notifications.error(err.message); }
        };
      }
      Actions.scan(container);
    } catch (e) { StateViews.error(container, e.message); }
  },
  _esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; },
};

window.OverviewScreen = OverviewScreen;
