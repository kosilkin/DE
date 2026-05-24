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
        <h3 style="margin-bottom:12px">Таблицы</h3>
        ${entities.length ? entities.map(e => `
          <div class="entity-list-item" data-action="designerTab" data-params='{"tab":"structure"}'>
            <span class="eli-title">${this._esc(e.title)}</span>
            <span class="eli-meta">${e.name}</span>
          </div>
        `).join('') : '<p style="color:var(--text-secondary)">Таблицы не созданы</p>'}
      `;
      Actions.scan(container);
    } catch (e) { StateViews.error(container, e.message); }
  },
  _esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; },
};

window.OverviewScreen = OverviewScreen;
