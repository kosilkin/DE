'use strict';

const ImportScreen = {
  _state: { step: 0, filePath: null, preview: null, entityId: null, mapping: {}, dryRunResult: null },

  async render(container) {
    const projectId = AppState.currentProject.id;
    try {
      const entities = await callApi(() => api.entities.list(projectId));
      if (!entities.length) {
        StateViews.empty(container, 'Нет таблиц для импорта');
        return;
      }
      this._state = { step: 0, filePath: null, preview: null, entityId: entities[0].id, mapping: {}, dryRunResult: null };
      this._renderWizard(container, entities);
    } catch (e) { StateViews.error(container, e.message); }
  },

  _renderWizard(container, entities) {
    const esc = (s) => { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; };
    const steps = ['Выбор файла', 'Настройки', 'Маппинг', 'Проверка', 'Импорт'];
    const s = this._state;

    let html = '<div class="import-wizard"><h2>Импорт из Excel</h2>';
    html += '<div class="wizard-steps">';
    for (let i = 0; i < steps.length; i++) {
      const cls = i === s.step ? 'active' : (i < s.step ? 'done' : '');
      html += `<div class="wizard-step ${cls}">${steps[i]}</div>`;
    }
    html += '</div>';

    html += `<div class="form-group"><label>Целевая таблица</label><select id="import-entity" data-exempt="true">${entities.map(e => `<option value="${e.id}" ${s.entityId === e.id ? 'selected' : ''}>${esc(e.title)}</option>`).join('')}</select></div>`;

    if (s.step === 0) {
      html += `<div class="import-step"><button class="btn btn-primary" data-action="importPickFile">Выбрать файл Excel</button></div>`;
      if (s.filePath) html += `<p>Файл: ${s.filePath}</p><button class="btn btn-primary" data-action="importNext">Далее</button>`;
    } else if (s.step === 1 && s.preview) {
      html += `
        <div class="import-step">
          <div class="form-group"><label>Лист</label><select id="import-sheet" data-exempt="true">${s.preview.sheetNames.map(n => `<option ${n === s.preview.sheetName ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div>
          <div class="form-group"><label><input type="checkbox" id="import-headers" checked data-exempt="true" /> Первая строка — заголовки</label></div>
          <div class="form-group"><label>Строка заголовков</label><input type="number" id="import-header-row" value="1" min="1" data-exempt="true" /></div>
          <div class="form-group"><label>Первая строка данных</label><input type="number" id="import-data-row" value="2" min="1" data-exempt="true" /></div>
          <div class="form-group"><label><input type="checkbox" id="import-trim" checked data-exempt="true" /> Убирать пробелы</label></div>
          <h4>Предпросмотр (${s.preview.totalRows} строк)</h4>
          <div class="import-preview"><table><thead><tr>${s.preview.headers.map(h => `<th>${esc(String(h))}</th>`).join('')}</tr></thead><tbody>
            ${s.preview.previewRows.slice(0, 10).map(row => '<tr>' + row.map(c => `<td>${esc(String(c))}</td>`).join('') + '</tr>').join('')}
          </tbody></table></div>
          <div style="margin-top:12px"><button class="btn btn-primary" data-action="importNext">Далее</button> <button class="btn" data-action="importBack">Назад</button></div>
        </div>
      `;
    } else if (s.step === 2) {
      html += '<div class="import-step"><h4>Маппинг полей</h4><div id="import-mapping"></div>';
      html += '<div style="margin-top:12px"><button class="btn btn-primary" data-action="importNext">Проверить</button> <button class="btn" data-action="importBack">Назад</button></div></div>';
    } else if (s.step === 3 && s.dryRunResult) {
      html += `
        <div class="import-step">
          <div class="import-report">
            <p class="stat">Валидных строк: ${s.dryRunResult.imported}</p>
            <p class="stat">Пропущено: ${s.dryRunResult.skipped}</p>
            ${s.dryRunResult.errors.length ? '<div class="errors-list">' + s.dryRunResult.errors.map(e => `<div>${esc(e)}</div>`).join('') + '</div>' : '<p style="color:var(--success)">Ошибок нет</p>'}
          </div>
          <div style="margin-top:12px"><button class="btn btn-primary" data-action="importRun">Выполнить импорт</button> <button class="btn" data-action="importBack">Назад</button></div>
        </div>
      `;
    } else if (s.step === 4 && s.importResult) {
      html += `
        <div class="import-step">
          <div class="import-report">
            <p class="stat" style="color:var(--success)">Импортировано: ${s.importResult.imported}</p>
            <p class="stat">Пропущено: ${s.importResult.skipped}</p>
            ${s.importResult.errors.length ? '<div class="errors-list">' + s.importResult.errors.map(e => `<div>${esc(e)}</div>`).join('') + '</div>' : ''}
          </div>
          <div style="margin-top:12px"><button class="btn btn-primary" data-action="importReset">Новый импорт</button></div>
        </div>
      `;
    }

    html += '</div>';
    container.innerHTML = html;
    Actions.scan(container);

    const entitySelect = DOM.$('#import-entity', container);
    if (entitySelect) entitySelect.onchange = () => { s.entityId = parseInt(entitySelect.value); };

    if (s.step === 2) this._renderMapping(container);
  },

  async _renderMapping(container) {
    const el = DOM.$('#import-mapping', container);
    if (!el) return;
    const s = this._state;
    const fields = await callApi(() => api.fields.list(s.entityId));
    if (s.preview && Object.keys(s.mapping).length === 0) {
      const auto = await callApi(() => api.import.autoMapping(s.preview.headers, s.entityId));
      s.mapping = auto;
    }
    const esc = (str) => { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; };
    let html = '<table><thead><tr><th>Поле</th><th>→</th><th>Колонка Excel</th></tr></thead><tbody>';
    for (const f of fields) {
      html += `<tr><td>${esc(f.title)} (${f.name})</td><td class="arrow">→</td><td>
        <select data-field="${f.name}" class="mapping-select" data-exempt="true">
          <option value="">— пропустить —</option>
          ${s.preview.headers.map((h, i) => `<option value="${i}" ${s.mapping[f.name] === i ? 'selected' : ''}>${esc(String(h))}</option>`).join('')}
        </select>
      </td></tr>`;
    }
    html += '</tbody></table>';
    el.innerHTML = html;
    el.querySelectorAll('.mapping-select').forEach(sel => {
      sel.onchange = () => {
        const fieldName = sel.dataset.field;
        const val = sel.value;
        if (val === '') delete s.mapping[fieldName];
        else s.mapping[fieldName] = parseInt(val);
      };
    });
  },
};

Actions.register('importPickFile', async () => {
  const filePath = await callApi(() => api.import.pickExcelFile());
  if (!filePath) return;
  ImportScreen._state.filePath = filePath;
  const preview = await callApi(() => api.import.previewExcel(filePath));
  ImportScreen._state.preview = preview;
  ImportScreen._state.step = 1;
  ImportScreen._renderWizard(DOM.$('#main-content'), await callApi(() => api.entities.list(AppState.currentProject.id)));
});

Actions.register('importNext', async () => {
  const s = ImportScreen._state;
  if (s.step === 0 && s.filePath) {
    s.step = 1;
    if (!s.preview) {
      s.preview = await callApi(() => api.import.previewExcel(s.filePath));
    }
  } else if (s.step === 1) {
    s.step = 2;
  } else if (s.step === 2) {
    s.step = 3;
    s.dryRunResult = await callApi(() => api.import.runEntityImport(s.entityId, s.filePath, {
      mapping: s.mapping, dryRun: true,
      sheet: s.preview.sheetName, dataStartRow: 2, trimSpaces: true,
    }));
  }
  ImportScreen._renderWizard(DOM.$('#main-content'), await callApi(() => api.entities.list(AppState.currentProject.id)));
});

Actions.register('importBack', async () => {
  ImportScreen._state.step = Math.max(0, ImportScreen._state.step - 1);
  ImportScreen._renderWizard(DOM.$('#main-content'), await callApi(() => api.entities.list(AppState.currentProject.id)));
});

Actions.register('importRun', async () => {
  const s = ImportScreen._state;
  try {
    s.importResult = await callApi(() => api.import.runEntityImport(s.entityId, s.filePath, {
      mapping: s.mapping, dryRun: false,
      sheet: s.preview.sheetName, dataStartRow: 2, trimSpaces: true,
    }));
    s.step = 4;
    Notifications.success(`Импортировано: ${s.importResult.imported}`);
    ImportScreen._renderWizard(DOM.$('#main-content'), await callApi(() => api.entities.list(AppState.currentProject.id)));
  } catch (e) { Notifications.error(e.message); }
});

Actions.register('importReset', () => {
  ImportScreen._state = { step: 0, filePath: null, preview: null, entityId: ImportScreen._state.entityId, mapping: {} };
  ImportScreen.render(DOM.$('#main-content'));
});

window.ImportScreen = ImportScreen;
