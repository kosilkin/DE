'use strict';

const DataScreen = {
  async render(container) {
    const projectId = AppState.currentProject.id;
    StateViews.loading(container);
    try {
      const entities = await callApi(() => api.entities.list(projectId));
      if (!entities.length) {
        StateViews.empty(container, 'Нет таблиц для просмотра данных', [{ action: 'designerTab', label: 'Создать таблицу' }]);
        return;
      }
      this._renderMain(container, entities);
    } catch (e) { StateViews.error(container, e.message); }
  },

  _renderMain(container, entities) {
    const esc = (s) => { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; };
    container.innerHTML = `
      <h2>Данные</h2>
      <div class="toolbar" style="margin-top:16px">
        <label>Таблица: </label>
        <select id="data-entity-select" data-exempt="true">
          ${entities.map(e => `<option value="${e.id}">${esc(e.title)}</option>`).join('')}
        </select>
        <span class="toolbar-spacer"></span>
        <button class="btn btn-sm btn-danger" data-action="deleteAllData">Удалить все данные</button>
      </div>
      <div id="data-table-content"></div>
    `;
    const select = DOM.$('#data-entity-select', container);
    select.onchange = () => this._loadData(parseInt(select.value));
    this._loadData(entities[0].id);
  },

  async _loadData(entityId) {
    const el = DOM.$('#data-table-content');
    if (!el) return;
    StateViews.loading(el);
    try {
      const result = await callApi(() => api.runtime.listRecords(entityId, { page: 1, pageSize: 50 }));
      const fields = await callApi(() => api.fields.list(entityId));
      if (!result.records.length) {
        StateViews.empty(el, 'Записей пока нет');
        return;
      }
      let html = '<div class="runtime-table-wrap"><table class="runtime-table"><thead><tr><th>ID</th>';
      for (const f of fields) html += `<th>${f.title}</th>`;
      html += '</tr></thead><tbody>';
      for (const r of result.records) {
        html += '<tr>';
        html += `<td>${r.id}</td>`;
        for (const f of fields) {
          let val = r[f.name];
          if (val === null || val === undefined) val = '';
          html += `<td>${String(val)}</td>`;
        }
        html += '</tr>';
      }
      html += '</tbody></table></div>';
      html += `<div class="pagination"><span class="page-info">Страница ${result.page} из ${result.totalPages} (${result.total} записей)</span></div>`;
      el.innerHTML = html;
    } catch (e) { StateViews.error(el, e.message); }
  },
};

Actions.register('deleteAllData', async () => {
  const select = DOM.$('#data-entity-select');
  if (!select) return;
  const entityId = parseInt(select.value);
  const entityTitle = select.options[select.selectedIndex].text;
  if (!confirm(`Вы уверены, что хотите удалить ВСЕ данные из таблицы "${entityTitle}"? Это действие необратимо.`)) return;
  try {
    const count = await callApi(() => api.runtime.deleteAllRecords(entityId));
    Notifications.success(`Удалено записей: ${count}`);
    DataScreen._loadData(entityId);
  } catch (e) { Notifications.error(e.message); }
});

window.DataScreen = DataScreen;
