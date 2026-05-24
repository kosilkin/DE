'use strict';

const ErScreen = {
  async render(container) {
    StateViews.loading(container);
    try {
      const projectId = AppState.currentProject.id;
      const erResult = await callApi(() => api.export.er(projectId));
      const sqlResult = await callApi(() => api.export.sql(projectId));

      container.innerHTML = `
        <h2>ER-диаграмма и SQL</h2>
        <div class="toolbar" style="margin-top:16px">
          <button class="btn btn-primary btn-sm" data-action="exportErFile">Сохранить ER.svg</button>
          <button class="btn btn-sm" data-action="exportSqlFile">Сохранить SQL</button>
        </div>
        <div class="er-container" id="er-svg-container" style="margin-bottom:20px"></div>
        <h3 style="margin-bottom:8px">SQL-схема</h3>
        <pre id="sql-preview" style="background:#f8f9fa;padding:16px;border-radius:var(--radius);overflow:auto;max-height:400px;font-size:12px;border:1px solid var(--border)"></pre>
      `;
      Actions.scan(container);

      // We need to call these without dialog
      const entities = await callApi(() => api.entities.list(projectId));
      if (entities.length) {
        // Generate ER inline
        this._renderErInline(projectId);
        this._renderSqlInline(projectId);
      } else {
        DOM.$('#er-svg-container').innerHTML = '<p style="padding:20px;color:var(--text-secondary)">Нет таблиц для отображения</p>';
        DOM.$('#sql-preview').textContent = '-- Нет таблиц';
      }
    } catch (e) { StateViews.error(container, e.message); }
  },

  async _renderErInline(projectId) {
    // Since export:er opens dialog, we'll build ER in renderer from entities data
    try {
      const entities = await callApi(() => api.entities.list(projectId));
      const fieldsMap = {};
      for (const e of entities) {
        fieldsMap[e.id] = await callApi(() => api.fields.list(e.id));
      }
      const svgEl = DOM.$('#er-svg-container');
      if (!svgEl) return;

      const boxW = 200, boxH = 36, fieldH = 20, gapX = 260, gapY = 40;
      const cols = Math.max(1, Math.ceil(Math.sqrt(entities.length)));
      let svg = '';
      const positions = {};

      for (let i = 0; i < entities.length; i++) {
        const e = entities[i];
        const fields = fieldsMap[e.id] || [];
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = 20 + col * gapX;
        const y = 20 + row * (boxH + 10 * fieldH + gapY);
        const h = boxH + fields.length * fieldH + 10;
        positions[e.id] = { x, y, w: boxW, h };

        svg += `<rect x="${x}" y="${y}" width="${boxW}" height="${h}" fill="#f8f9fa" stroke="#333" rx="4"/>`;
        svg += `<rect x="${x}" y="${y}" width="${boxW}" height="${boxH}" fill="#4a90d9" stroke="#333" rx="4"/>`;
        svg += `<text x="${x + boxW / 2}" y="${y + 23}" text-anchor="middle" fill="#fff" font-weight="bold" font-size="13">${this._esc(e.title)}</text>`;
        svg += `<text x="${x + 8}" y="${y + boxH + 14}" fill="#888" font-size="10">id INTEGER PK</text>`;
        for (let fi = 0; fi < fields.length; fi++) {
          const f = fields[fi];
          const fy = y + boxH + 14 + (fi + 1) * fieldH;
          let label = `${f.name} ${f.type}`;
          if (f.required) label += ' *';
          svg += `<text x="${x + 8}" y="${fy}" fill="#333" font-size="11">${label}</text>`;
        }
      }

      // draw relation lines
      for (const e of entities) {
        const fields = fieldsMap[e.id] || [];
        for (const f of fields) {
          if (f.type === 'relation') {
            // find target by checking relations — simplified, match by name suffix
            for (const te of entities) {
              if (f.name.replace('_id', '') === te.name || f.name.replace('_id', 's') === te.name) {
                const src = positions[e.id];
                const tgt = positions[te.id];
                if (src && tgt) {
                  svg += `<line x1="${src.x + src.w}" y1="${src.y + src.h / 2}" x2="${tgt.x}" y2="${tgt.y + tgt.h / 2}" stroke="#999" stroke-width="1" stroke-dasharray="4"/>`;
                }
              }
            }
          }
        }
      }

      const svgW = 20 + cols * gapX + 50;
      const maxRow = Math.ceil(entities.length / cols);
      const svgH = 20 + maxRow * (boxH + 10 * fieldH + gapY) + 50;

      svgEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" style="font-family:sans-serif">${svg}</svg>`;
    } catch (e) {
      const svgEl = DOM.$('#er-svg-container');
      if (svgEl) svgEl.innerHTML = `<p style="color:var(--danger);padding:16px">${e.message}</p>`;
    }
  },

  async _renderSqlInline(projectId) {
    // Generate SQL preview (not through dialog)
    try {
      const entities = await callApi(() => api.entities.list(projectId));
      let sql = '';
      for (const entity of entities) {
        const fields = await callApi(() => api.fields.list(entity.id));
        sql += `-- ${entity.title}\n`;
        sql += `CREATE TABLE p${projectId}_${entity.name} (\n`;
        sql += '  id INTEGER PRIMARY KEY AUTOINCREMENT,\n';
        for (const f of fields) {
          const types = { text: 'TEXT', number: 'REAL', date: 'TEXT', datetime: 'TEXT', boolean: 'INTEGER', select: 'TEXT', relation: 'INTEGER' };
          let def = `  ${f.name} ${types[f.type] || 'TEXT'}`;
          if (f.required) def += ' NOT NULL';
          if (f.unique_value) def += ' UNIQUE';
          sql += def + ',\n';
        }
        sql += '  created_at TEXT NOT NULL,\n';
        sql += '  updated_at TEXT NOT NULL\n';
        sql += ');\n\n';
      }
      const preEl = DOM.$('#sql-preview');
      if (preEl) preEl.textContent = sql || '-- Нет таблиц';
    } catch (e) {
      const preEl = DOM.$('#sql-preview');
      if (preEl) preEl.textContent = `-- Ошибка: ${e.message}`;
    }
  },

  _esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; },
};

Actions.register('exportErFile', async () => {
  try {
    const result = await callApi(() => api.export.er(AppState.currentProject.id));
    if (result) Notifications.success('ER-диаграмма сохранена');
  } catch (e) { Notifications.error(e.message); }
});

Actions.register('exportSqlFile', async () => {
  try {
    const result = await callApi(() => api.export.sql(AppState.currentProject.id));
    if (result) Notifications.success('SQL сохранён');
  } catch (e) { Notifications.error(e.message); }
});

window.ErScreen = ErScreen;
