'use strict';

const StructureScreen = {
  _selectedEntityId: null,

  async render(container) {
    StateViews.loading(container);
    try {
      const entities = await callApi(() => api.entities.list(AppState.currentProject.id));
      this._renderSplit(container, entities);
    } catch (e) { StateViews.error(container, e.message); }
  },

  _renderSplit(container, entities) {
    container.innerHTML = `
      <h2>Структура</h2>
      <div class="split-layout" style="margin-top:16px">
        <div class="split-left">
          <div class="toolbar">
            <button class="btn btn-primary btn-sm" data-action="createEntity">Создать таблицу</button>
          </div>
          <div id="entity-list"></div>
        </div>
        <div class="split-right" id="entity-detail">
          <div class="empty-state"><div class="es-text">Выберите таблицу слева</div></div>
        </div>
      </div>
    `;
    const listEl = DOM.$('#entity-list', container);
    for (const e of entities) {
      const item = DOM.el('div', {
        className: `entity-list-item ${this._selectedEntityId === e.id ? 'active' : ''}`,
        dataset: { action: 'selectEntity', params: JSON.stringify({ id: e.id }) },
      },
        DOM.el('span', { className: 'eli-title', textContent: e.title }),
        DOM.el('span', { className: 'eli-meta', textContent: e.name })
      );
      listEl.appendChild(item);
    }
    Actions.scan(container);

    if (this._selectedEntityId) {
      this._loadEntityDetail(this._selectedEntityId);
    }
  },

  async _loadEntityDetail(entityId) {
    this._selectedEntityId = entityId;
    const detailEl = DOM.$('#entity-detail');
    if (!detailEl) return;
    StateViews.loading(detailEl);
    try {
      const entity = await callApi(() => api.entities.get(entityId));
      const fields = await callApi(() => api.fields.list(entityId));
      const allEntities = await callApi(() => api.entities.list(AppState.currentProject.id));
      this._renderDetail(detailEl, entity, fields, allEntities);
    } catch (e) { StateViews.error(detailEl, e.message); }
  },

  _renderDetail(detailEl, entity, fields, allEntities) {
    const esc = (s) => { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; };
    let html = `
      <div class="card" style="margin-bottom:16px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
          <h3>${esc(entity.title)}</h3>
          <span class="badge badge-info">${entity.name}</span>
          <span style="flex:1"></span>
          <button class="btn btn-sm" data-action="editEntity" data-params='{"id":${entity.id}}'>Изменить</button>
          <button class="btn btn-sm btn-danger" data-action="deleteEntity" data-params='{"id":${entity.id}}'>Удалить</button>
        </div>
        <p style="color:var(--text-secondary);font-size:13px">${esc(entity.description || '')}</p>
        <div style="margin-top:8px;font-size:12px;color:var(--text-secondary)">
          Display field ID: ${entity.display_field_id || '—'} | Owner field ID: ${entity.owner_field_id || '—'}
        </div>
      </div>
      <div class="toolbar">
        <h4>Поля</h4>
        <span class="toolbar-spacer"></span>
        <button class="btn btn-primary btn-sm" data-action="createField" data-params='{"entityId":${entity.id}}'>Добавить поле</button>
      </div>
    `;

    if (!fields.length) {
      html += '<p style="color:var(--text-secondary)">Полей пока нет</p>';
    } else {
      html += '<table><thead><tr><th>Имя</th><th>Название</th><th>Тип</th><th>Обязательное</th><th>Уникальное</th><th>Действия</th></tr></thead><tbody>';
      for (const f of fields) {
        html += `<tr>
          <td><code>${f.name}</code></td>
          <td>${esc(f.title)}</td>
          <td><span class="badge badge-info">${f.type}</span></td>
          <td>${f.required ? 'Да' : '—'}</td>
          <td>${f.unique_value ? 'Да' : '—'}</td>
          <td>
            <button class="btn btn-sm" data-action="editField" data-params='{"id":${f.id},"entityId":${entity.id}}'>Изменить</button>
            ${f.is_system ? '' : `<button class="btn btn-sm btn-danger" data-action="deleteField" data-params='{"id":${f.id},"entityId":${entity.id}}'>Удалить</button>`}
          </td>
        </tr>`;
      }
      html += '</tbody></table>';
    }

    // Display/Owner field selectors
    html += `
      <div style="margin-top:20px;display:flex;gap:16px">
        <div class="form-group">
          <label>Display field</label>
          <select data-action="setDisplayField" data-params='{"entityId":${entity.id}}' data-exempt="true" id="display-field-select">
            <option value="">—</option>
            ${fields.map(f => `<option value="${f.id}" ${entity.display_field_id === f.id ? 'selected' : ''}>${esc(f.title)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Owner field</label>
          <select data-exempt="true" id="owner-field-select">
            <option value="">—</option>
            ${fields.filter(f => f.type === 'relation').map(f => `<option value="${f.id}" ${entity.owner_field_id === f.id ? 'selected' : ''}>${esc(f.title)}</option>`).join('')}
          </select>
        </div>
      </div>
    `;

    detailEl.innerHTML = html;
    Actions.scan(detailEl);

    // Bind display/owner field changes
    const displaySelect = DOM.$('#display-field-select', detailEl);
    const ownerSelect = DOM.$('#owner-field-select', detailEl);
    if (displaySelect) {
      displaySelect.onchange = async () => {
        try {
          await callApi(() => api.entities.update(entity.id, { display_field_id: parseInt(displaySelect.value) || null }));
          Notifications.success('Display field обновлён');
        } catch (e) { Notifications.error(e.message); }
      };
    }
    if (ownerSelect) {
      ownerSelect.onchange = async () => {
        try {
          await callApi(() => api.entities.update(entity.id, { owner_field_id: parseInt(ownerSelect.value) || null }));
          Notifications.success('Owner field обновлён');
        } catch (e) { Notifications.error(e.message); }
      };
    }

    // Highlight active entity in list
    DOM.$$('.entity-list-item').forEach(el => {
      try {
        const p = JSON.parse(el.dataset.params || '{}');
        el.classList.toggle('active', p.id === entity.id);
      } catch {}
    });
  },

  _showFieldModal(entityId, existingField) {
    const isEdit = !!existingField;
    const overlay = DOM.el('div', { className: 'modal-overlay' });
    const modal = DOM.el('div', { className: 'modal' });

    const types = ['text', 'number', 'date', 'datetime', 'boolean', 'select', 'relation'];
    const currentType = existingField ? existingField.type : 'text';

    modal.innerHTML = `
      <div class="modal-title">${isEdit ? 'Редактировать поле' : 'Добавить поле'}</div>
      <div class="form-group"><label>Системное имя (латиница)</label><input type="text" id="field-name" value="${isEdit ? existingField.name : ''}" ${isEdit ? 'disabled' : ''} placeholder="field_name" /></div>
      <div class="form-group"><label>Название</label><input type="text" id="field-title" value="${isEdit ? this._esc(existingField.title) : ''}" placeholder="Название поля" /></div>
      <div class="form-group"><label>Тип</label><select id="field-type" ${isEdit ? 'disabled' : ''}>${types.map(t => `<option value="${t}" ${currentType === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="form-group"><label><input type="checkbox" id="field-required" ${existingField && existingField.required ? 'checked' : ''} /> Обязательное</label></div>
      <div class="form-group"><label><input type="checkbox" id="field-unique" ${existingField && existingField.unique_value ? 'checked' : ''} /> Уникальное</label></div>
      <div class="form-group"><label>Значение по умолчанию</label><input type="text" id="field-default" value="${existingField && existingField.default_value ? existingField.default_value : ''}" /></div>
      <div class="form-group" id="options-group" style="display:none"><label>Варианты (через запятую)</label><input type="text" id="field-options" value="" /></div>
      <div class="form-group" id="target-entity-group" style="display:none"><label>Целевая таблица</label><select id="field-target-entity"></select></div>
      <div class="form-group" id="validation-group">
        <label>Валидация (JSON)</label>
        <textarea id="field-validation" placeholder='{"minLength": 1, "maxLength": 100}'>${existingField && existingField.validation_json ? existingField.validation_json : ''}</textarea>
      </div>
      <div class="modal-actions">
        <button class="btn" data-exempt="true" id="modal-cancel">Отмена</button>
        <button class="btn btn-primary" data-exempt="true" id="modal-save">${isEdit ? 'Сохранить' : 'Добавить'}</button>
      </div>
    `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const typeSelect = DOM.$('#field-type', modal);
    const optionsGroup = DOM.$('#options-group', modal);
    const targetGroup = DOM.$('#target-entity-group', modal);

    const updateTypeFields = async () => {
      const t = typeSelect.value;
      optionsGroup.style.display = t === 'select' ? '' : 'none';
      targetGroup.style.display = t === 'relation' ? '' : 'none';
      if (t === 'relation') {
        const entities = await callApi(() => api.entities.list(AppState.currentProject.id));
        DOM.$('#field-target-entity', modal).innerHTML = entities.map(e => `<option value="${e.id}">${e.title}</option>`).join('');
      }
    };
    typeSelect.onchange = updateTypeFields;

    if (existingField && existingField.options_json) {
      try {
        const opts = JSON.parse(existingField.options_json);
        DOM.$('#field-options', modal).value = Array.isArray(opts) ? opts.join(', ') : '';
      } catch {}
    }

    updateTypeFields();

    DOM.$('#modal-cancel', modal).onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    DOM.$('#modal-save', modal).onclick = async () => {
      const data = {
        name: DOM.$('#field-name', modal).value.trim(),
        title: DOM.$('#field-title', modal).value.trim(),
        type: typeSelect.value,
        required: DOM.$('#field-required', modal).checked,
        unique_value: DOM.$('#field-unique', modal).checked,
        default_value: DOM.$('#field-default', modal).value.trim() || null,
        validation_json: DOM.$('#field-validation', modal).value.trim() || null,
      };
      if (typeSelect.value === 'select') {
        const opts = DOM.$('#field-options', modal).value.split(',').map(s => s.trim()).filter(Boolean);
        data.options_json = JSON.stringify(opts);
      }
      if (typeSelect.value === 'relation') {
        data.target_entity_id = parseInt(DOM.$('#field-target-entity', modal).value);
      }
      try {
        if (isEdit) {
          await callApi(() => api.fields.update(existingField.id, data));
          Notifications.success('Поле обновлено');
        } else {
          await callApi(() => api.fields.create(entityId, data));
          Notifications.success('Поле добавлено');
        }
        overlay.remove();
        this._loadEntityDetail(entityId);
      } catch (e) { Notifications.error(e.message); }
    };
  },

  _esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; },
};

Actions.register('selectEntity', (params) => StructureScreen._loadEntityDetail(params.id));

Actions.register('createEntity', () => {
  const overlay = DOM.el('div', { className: 'modal-overlay' });
  const modal = DOM.el('div', { className: 'modal' });
  modal.innerHTML = `
    <div class="modal-title">Создать таблицу</div>
    <div class="form-group"><label>Системное имя (латиница)</label><input type="text" id="entity-name" placeholder="entity_name" /></div>
    <div class="form-group"><label>Название</label><input type="text" id="entity-title" placeholder="Название таблицы" /></div>
    <div class="form-group"><label>Описание</label><textarea id="entity-desc" placeholder="Описание"></textarea></div>
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
      const entity = await callApi(() => api.entities.create(AppState.currentProject.id, {
        name: DOM.$('#entity-name', modal).value.trim(),
        title: DOM.$('#entity-title', modal).value.trim(),
        description: DOM.$('#entity-desc', modal).value.trim(),
      }));
      Notifications.success('Таблица создана');
      overlay.remove();
      StructureScreen._selectedEntityId = entity.id;
      StructureScreen.render(DOM.$('#main-content'));
    } catch (e) { Notifications.error(e.message); }
  };
});

Actions.register('editEntity', async (params) => {
  const entity = await callApi(() => api.entities.get(params.id));
  const overlay = DOM.el('div', { className: 'modal-overlay' });
  const modal = DOM.el('div', { className: 'modal' });
  const esc = (s) => { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; };
  modal.innerHTML = `
    <div class="modal-title">Редактировать таблицу</div>
    <div class="form-group"><label>Название</label><input type="text" id="entity-title" value="${esc(entity.title)}" /></div>
    <div class="form-group"><label>Описание</label><textarea id="entity-desc">${esc(entity.description || '')}</textarea></div>
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
      await callApi(() => api.entities.update(entity.id, {
        title: DOM.$('#entity-title', modal).value.trim(),
        description: DOM.$('#entity-desc', modal).value.trim(),
      }));
      Notifications.success('Таблица обновлена');
      overlay.remove();
      StructureScreen.render(DOM.$('#main-content'));
    } catch (e) { Notifications.error(e.message); }
  };
});

Actions.register('deleteEntity', async (params) => {
  if (!confirm('Удалить таблицу и все её данные?')) return;
  try {
    await callApi(() => api.entities.delete(params.id));
    Notifications.success('Таблица удалена');
    StructureScreen._selectedEntityId = null;
    StructureScreen.render(DOM.$('#main-content'));
  } catch (e) { Notifications.error(e.message); }
});

Actions.register('createField', (params) => StructureScreen._showFieldModal(params.entityId));

Actions.register('editField', async (params) => {
  const fields = await callApi(() => api.fields.list(params.entityId));
  const field = fields.find(f => f.id === params.id);
  if (field) StructureScreen._showFieldModal(params.entityId, field);
});

Actions.register('deleteField', async (params) => {
  if (!confirm('Удалить поле?')) return;
  try {
    await callApi(() => api.fields.delete(params.id));
    Notifications.success('Поле удалено');
    StructureScreen._loadEntityDetail(params.entityId);
  } catch (e) { Notifications.error(e.message); }
});

window.StructureScreen = StructureScreen;
