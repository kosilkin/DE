'use strict';

const RuntimeFilters = {
  async render(container, entityId, currentFilters, onApply) {
    const fields = await callApi(() => api.fields.list(entityId));
    const esc = (s) => { const d = document.createElement('div'); d.textContent = String(s); return d.innerHTML; };

    let html = '<div class="filters-panel"><h4 style="margin-bottom:8px">Фильтры</h4>';
    html += '<div id="filter-rows">';

    const ops = [
      { value: 'eq', label: '=' },
      { value: 'neq', label: '≠' },
      { value: 'gt', label: '>' },
      { value: 'gte', label: '≥' },
      { value: 'lt', label: '<' },
      { value: 'lte', label: '≤' },
      { value: 'like', label: 'содержит' },
      { value: 'is_null', label: 'пусто' },
      { value: 'not_null', label: 'не пусто' },
    ];

    if (currentFilters.length === 0) currentFilters.push({ field: '', op: 'eq', value: '' });

    for (let i = 0; i < currentFilters.length; i++) {
      const f = currentFilters[i];
      html += `<div class="filter-row" data-idx="${i}">
        <select class="filter-field" data-exempt="true">${fields.map(fi => `<option value="${fi.name}" ${f.field === fi.name ? 'selected' : ''}>${esc(fi.title)}</option>`).join('')}</select>
        <select class="filter-op" data-exempt="true">${ops.map(o => `<option value="${o.value}" ${f.op === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}</select>
        <input type="text" class="filter-value" value="${esc(f.value || '')}" placeholder="Значение" data-exempt="true" />
        <button class="btn btn-sm btn-danger" data-exempt="true" onclick="this.closest('.filter-row').remove()">✕</button>
      </div>`;
    }

    html += '</div>';
    html += '<div style="margin-top:8px;display:flex;gap:8px">';
    html += '<button class="btn btn-sm" data-exempt="true" id="add-filter-btn">Добавить фильтр</button>';
    html += '<button class="btn btn-sm btn-primary" data-exempt="true" id="apply-filters-btn">Применить</button>';
    html += '<button class="btn btn-sm" data-exempt="true" id="clear-filters-btn">Сбросить</button>';
    html += '</div></div>';

    container.innerHTML = html;

    DOM.$('#add-filter-btn', container).onclick = () => {
      currentFilters.push({ field: fields[0] ? fields[0].name : '', op: 'eq', value: '' });
      this.render(container, entityId, currentFilters, onApply);
    };

    DOM.$('#apply-filters-btn', container).onclick = () => {
      const rows = DOM.$$('.filter-row', container);
      const filters = rows.map(row => ({
        field: row.querySelector('.filter-field').value,
        op: row.querySelector('.filter-op').value,
        value: row.querySelector('.filter-value').value,
      })).filter(f => f.field && f.op);
      onApply(filters);
    };

    DOM.$('#clear-filters-btn', container).onclick = () => {
      onApply([]);
      container.innerHTML = '';
      container.classList.add('hidden');
    };
  },
};

window.RuntimeFilters = RuntimeFilters;
