'use strict';

const RuntimeList = {
  _opts: { page: 1, pageSize: 25, sortField: null, sortDir: 'asc', search: '', filters: [] },

  async render(container, entityId) {
    StateViews.loading(container);
    this._opts.page = 1;
    this._entityId = entityId;
    await this._load(container);
  },

  async _load(container) {
    try {
      const entity = await callApi(() => api.entities.get(this._entityId));
      const fields = await callApi(() => api.fields.list(this._entityId));
      const result = await callApi(() => api.runtime.listRecords(this._entityId, this._opts));

      // resolve relation display values using actual relations data
      const relationFields = fields.filter(f => f.type === 'relation');
      const relationDisplayMap = {};
      if (relationFields.length) {
        const relations = await callApi(() => api.relations.list(AppState.currentProject.id));
        for (const rf of relationFields) {
          const rel = relations.find(r => r.source_field_id === rf.id);
          if (rel) {
            try {
              const opts = await callApi(() => api.runtime.relationOptions(rel.target_entity_id));
              const map = {};
              for (const o of opts) map[o.id] = o.display;
              relationDisplayMap[rf.name] = map;
            } catch {}
          }
        }
      }

      this._relationDisplayMap = relationDisplayMap;
      this._renderTable(container, entity, fields, result);
    } catch (e) {
      if (e.message && e.message.includes('Нет доступа')) {
        StateViews.noAccess(container);
      } else {
        StateViews.error(container, e.message);
      }
    }
  },

  _renderTable(container, entity, fields, result) {
    const esc = (s) => { const d = document.createElement('div'); d.textContent = String(s); return d.innerHTML; };
    const { records, total, page, pageSize, totalPages } = result;

    let html = `<h2>${esc(entity.title)}</h2>`;
    html += `<div class="toolbar" style="margin-top:12px">`;
    html += `<input type="text" class="search-input" id="runtime-search" placeholder="Поиск..." value="${esc(this._opts.search)}" data-exempt="true" />`;
    html += `<button class="btn btn-sm" data-action="runtimeApplySearch">Найти</button>`;
    html += `<button class="btn btn-sm" data-action="runtimeToggleFilters">Фильтры</button>`;
    html += `<span class="toolbar-spacer"></span>`;
    html += `<button class="btn btn-primary btn-sm" data-action="runtimeCreate" data-params='{"entityId":${entity.id}}'>Создать запись</button>`;
    html += `</div>`;

    html += `<div id="runtime-filters-panel" class="hidden"></div>`;

    if (!records.length) {
      html += `<div class="empty-state"><div class="es-icon">📋</div><div class="es-text">Записей пока нет</div>`;
      html += `<div class="es-actions"><button class="btn btn-primary" data-action="runtimeCreate" data-params='{"entityId":${entity.id}}'>Создать запись</button></div></div>`;
    } else {
      html += '<div class="runtime-table-wrap"><table class="runtime-table"><thead><tr>';
      html += `<th data-action="runtimeSort" data-params='{"field":"id"}'>ID <span class="sort-arrow">${this._sortArrow('id')}</span></th>`;
      for (const f of fields) {
        html += `<th data-action="runtimeSort" data-params='{"field":"${f.name}"}'>`;
        html += `${esc(f.title)} <span class="sort-arrow">${this._sortArrow(f.name)}</span></th>`;
      }
      html += '<th>Действия</th></tr></thead><tbody>';

      for (const r of records) {
        html += '<tr>';
        html += `<td>${r.id}</td>`;
        for (const f of fields) {
          let val = r[f.name];
          if (val === null || val === undefined) val = '';
          if (f.type === 'boolean') val = val ? 'Да' : 'Нет';
          else if (f.type === 'relation' && this._relationDisplayMap[f.name] && val) {
            val = this._relationDisplayMap[f.name][val] || `#${val}`;
          }
          html += `<td>${esc(val)}</td>`;
        }
        html += `<td>
          <button class="btn btn-sm" data-action="runtimeEdit" data-params='{"entityId":${entity.id},"recordId":${r.id}}'>Открыть</button>
          <button class="btn btn-sm btn-danger" data-action="runtimeDelete" data-params='{"entityId":${entity.id},"recordId":${r.id}}'>Удалить</button>
        </td>`;
        html += '</tr>';
      }
      html += '</tbody></table></div>';

      html += '<div class="pagination">';
      html += `<button class="btn btn-sm" data-action="runtimePage" data-params='{"page":${page - 1}}' ${page <= 1 ? 'disabled' : ''}>← Назад</button>`;
      html += `<span class="page-info">Стр. ${page} из ${totalPages} (${total})</span>`;
      html += `<button class="btn btn-sm" data-action="runtimePage" data-params='{"page":${page + 1}}' ${page >= totalPages ? 'disabled' : ''}>Вперёд →</button>`;
      html += '</div>';
    }

    container.innerHTML = html;
    Actions.scan(container);

    DOM.$('#runtime-search', container).addEventListener('keydown', (e) => {
      if (e.key === 'Enter') Actions.execute('runtimeApplySearch');
    });
  },

  _sortArrow(field) {
    if (this._opts.sortField !== field) return '';
    return this._opts.sortDir === 'asc' ? '▲' : '▼';
  },
};

Actions.register('runtimeApplySearch', async () => {
  RuntimeList._opts.search = DOM.$('#runtime-search').value;
  RuntimeList._opts.page = 1;
  await RuntimeList._load(DOM.$('#main-content'));
});

Actions.register('runtimeToggleFilters', () => {
  const panel = DOM.$('#runtime-filters-panel');
  if (!panel) return;
  panel.classList.toggle('hidden');
  if (!panel.classList.contains('hidden')) {
    RuntimeFilters.render(panel, RuntimeList._entityId, RuntimeList._opts.filters, async (filters) => {
      RuntimeList._opts.filters = filters;
      RuntimeList._opts.page = 1;
      await RuntimeList._load(DOM.$('#main-content'));
    });
  }
});

Actions.register('runtimeSort', (params) => {
  if (RuntimeList._opts.sortField === params.field) {
    RuntimeList._opts.sortDir = RuntimeList._opts.sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    RuntimeList._opts.sortField = params.field;
    RuntimeList._opts.sortDir = 'asc';
  }
  RuntimeList._load(DOM.$('#main-content'));
});

Actions.register('runtimePage', (params) => {
  RuntimeList._opts.page = params.page;
  RuntimeList._load(DOM.$('#main-content'));
});

Actions.register('runtimeCreate', (params) => {
  RuntimeForm.show(params.entityId, null, async () => {
    await RuntimeList._load(DOM.$('#main-content'));
  });
});

Actions.register('runtimeEdit', (params) => {
  RuntimeForm.show(params.entityId, params.recordId, async () => {
    await RuntimeList._load(DOM.$('#main-content'));
  });
});

Actions.register('runtimeDelete', async (params) => {
  if (!confirm('Удалить запись?')) return;
  try {
    await callApi(() => api.runtime.deleteRecord(params.entityId, params.recordId));
    Notifications.success('Запись удалена');
    await RuntimeList._load(DOM.$('#main-content'));
  } catch (e) { Notifications.error(e.message); }
});

window.RuntimeList = RuntimeList;
