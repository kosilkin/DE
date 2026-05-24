'use strict';

const ErScreen = {
  _positions: {},
  _entities: [],
  _fieldsMap: {},
  _dragging: null,

  async render(container) {
    StateViews.loading(container);
    try {
      const projectId = AppState.currentProject.id;

      container.innerHTML = `
        <h2>ER-диаграмма и SQL</h2>
        <div class="toolbar" style="margin-top:16px">
          <button class="btn btn-primary btn-sm" data-action="exportErFile">Сохранить ER.svg</button>
          <button class="btn btn-sm" data-action="exportSqlFile">Сохранить SQL</button>
        </div>
        <div class="er-container" id="er-svg-container" style="margin-bottom:20px;border:1px solid var(--border);border-radius:var(--radius);overflow:auto;min-height:300px;background:#fff;cursor:default"></div>
        <h3 style="margin-bottom:8px">SQL-схема</h3>
        <pre id="sql-preview" style="background:#f8f9fa;padding:16px;border-radius:var(--radius);overflow:auto;max-height:400px;font-size:12px;border:1px solid var(--border)"></pre>
      `;

      const entities = await callApi(() => api.entities.list(projectId));
      if (entities.length) {
        this._entities = entities;
        this._fieldsMap = {};
        for (const e of entities) {
          this._fieldsMap[e.id] = await callApi(() => api.fields.list(e.id));
        }
        this._initPositions();
        this._renderSvg();
        this._attachDragHandlers();
        this._renderSqlInline(projectId);
      } else {
        DOM.$('#er-svg-container').innerHTML = '<p style="padding:20px;color:var(--text-secondary)">Нет таблиц для отображения</p>';
        DOM.$('#sql-preview').textContent = '-- Нет таблиц';
      }
    } catch (e) { StateViews.error(container, e.message); }
  },

  _initPositions() {
    const boxW = 200, boxH = 36, fieldH = 20, gapX = 280, gapY = 50;
    const cols = Math.max(1, Math.ceil(Math.sqrt(this._entities.length)));
    this._positions = {};
    for (let i = 0; i < this._entities.length; i++) {
      const e = this._entities[i];
      const fields = this._fieldsMap[e.id] || [];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = 30 + col * gapX;
      const y = 30 + row * (boxH + 10 * fieldH + gapY);
      const h = boxH + (fields.length + 1) * fieldH + 10;
      this._positions[e.id] = { x, y, w: boxW, h };
    }
  },

  _renderSvg() {
    const svgEl = DOM.$('#er-svg-container');
    if (!svgEl) return;
    const positions = this._positions;
    const entities = this._entities;
    const fieldsMap = this._fieldsMap;

    let maxX = 0, maxY = 0;
    for (const p of Object.values(positions)) {
      maxX = Math.max(maxX, p.x + p.w + 40);
      maxY = Math.max(maxY, p.y + p.h + 40);
    }

    let svg = '';

    // Draw relation arrows first (behind entities)
    svg += this._drawRelationArrows();

    // Draw entity boxes
    for (const e of entities) {
      const fields = fieldsMap[e.id] || [];
      const p = positions[e.id];
      if (!p) continue;
      const h = p.h;

      svg += `<g class="er-entity" data-entity-id="${e.id}" style="cursor:grab">`;
      svg += `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${h}" fill="#f8f9fa" stroke="#333" rx="4" class="er-box"/>`;
      svg += `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="36" fill="#4a90d9" stroke="#333" rx="4" class="er-header"/>`;
      svg += `<text x="${p.x + p.w / 2}" y="${p.y + 23}" text-anchor="middle" fill="#fff" font-weight="bold" font-size="13" style="pointer-events:none">${this._esc(e.title)}</text>`;
      svg += `<text x="${p.x + 8}" y="${p.y + 50}" fill="#888" font-size="10" style="pointer-events:none">id INTEGER PK</text>`;
      for (let fi = 0; fi < fields.length; fi++) {
        const f = fields[fi];
        const fy = p.y + 50 + (fi + 1) * 20;
        let label = `${f.name} ${f.type}`;
        if (f.required) label += ' *';
        const color = f.type === 'relation' ? '#4a90d9' : '#333';
        svg += `<text x="${p.x + 8}" y="${fy}" fill="${color}" font-size="11" style="pointer-events:none">${this._esc(label)}</text>`;
      }
      svg += '</g>';
    }

    svgEl.innerHTML = `<svg id="er-svg" xmlns="http://www.w3.org/2000/svg" width="${maxX}" height="${maxY}" style="font-family:sans-serif">${svg}</svg>`;
  },

  _drawRelationArrows() {
    const positions = this._positions;
    const entities = this._entities;
    const fieldsMap = this._fieldsMap;
    let svg = '';

    const relations = [];
    for (const e of entities) {
      const fields = fieldsMap[e.id] || [];
      for (const f of fields) {
        if (f.type !== 'relation') continue;
        for (const te of entities) {
          if (f.name.replace('_id', '') === te.name || f.name.replace('_id', 's') === te.name) {
            relations.push({ src: e.id, tgt: te.id, fieldName: f.name });
          }
        }
      }
    }

    for (const rel of relations) {
      const src = positions[rel.src];
      const tgt = positions[rel.tgt];
      if (!src || !tgt) continue;

      // Find best connection points (avoid going through other entities)
      const pts = this._findConnectionPoints(src, tgt);
      const path = this._buildPath(pts.x1, pts.y1, pts.x2, pts.y2, pts.side1, pts.side2);

      svg += `<path d="${path}" fill="none" stroke="#4a90d9" stroke-width="1.5" marker-end="url(#arrowhead)"/>`;
    }

    // Arrowhead marker definition
    svg = `<defs><marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#4a90d9"/></marker></defs>` + svg;

    return svg;
  },

  _findConnectionPoints(src, tgt) {
    const srcCx = src.x + src.w / 2;
    const srcCy = src.y + src.h / 2;
    const tgtCx = tgt.x + tgt.w / 2;
    const tgtCy = tgt.y + tgt.h / 2;

    const dx = tgtCx - srcCx;
    const dy = tgtCy - srcCy;

    let x1, y1, x2, y2, side1, side2;

    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) {
        x1 = src.x + src.w; y1 = srcCy; side1 = 'right';
        x2 = tgt.x; y2 = tgtCy; side2 = 'left';
      } else {
        x1 = src.x; y1 = srcCy; side1 = 'left';
        x2 = tgt.x + tgt.w; y2 = tgtCy; side2 = 'right';
      }
    } else {
      if (dy > 0) {
        x1 = srcCx; y1 = src.y + src.h; side1 = 'bottom';
        x2 = tgtCx; y2 = tgt.y; side2 = 'top';
      } else {
        x1 = srcCx; y1 = src.y; side1 = 'top';
        x2 = tgtCx; y2 = tgt.y + tgt.h; side2 = 'bottom';
      }
    }

    return { x1, y1, x2, y2, side1, side2 };
  },

  _buildPath(x1, y1, x2, y2, side1, side2) {
    const offset = 30;
    let cx1, cy1, cx2, cy2;

    if (side1 === 'right') { cx1 = x1 + offset; cy1 = y1; }
    else if (side1 === 'left') { cx1 = x1 - offset; cy1 = y1; }
    else if (side1 === 'bottom') { cx1 = x1; cy1 = y1 + offset; }
    else { cx1 = x1; cy1 = y1 - offset; }

    if (side2 === 'left') { cx2 = x2 - offset; cy2 = y2; }
    else if (side2 === 'right') { cx2 = x2 + offset; cy2 = y2; }
    else if (side2 === 'top') { cx2 = x2; cy2 = y2 - offset; }
    else { cx2 = x2; cy2 = y2 + offset; }

    return `M${x1},${y1} C${cx1},${cy1} ${cx2},${cy2} ${x2},${y2}`;
  },

  _attachDragHandlers() {
    const svgEl = DOM.$('#er-svg');
    if (!svgEl) return;
    const self = this;

    svgEl.addEventListener('mousedown', (e) => {
      const group = e.target.closest('.er-entity');
      if (!group) return;
      const entityId = parseInt(group.dataset.entityId);
      const pos = self._positions[entityId];
      if (!pos) return;

      self._dragging = {
        entityId,
        startX: e.clientX,
        startY: e.clientY,
        origX: pos.x,
        origY: pos.y,
      };
      group.style.cursor = 'grabbing';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!self._dragging) return;
      const dx = e.clientX - self._dragging.startX;
      const dy = e.clientY - self._dragging.startY;
      const pos = self._positions[self._dragging.entityId];
      if (pos) {
        pos.x = Math.max(5, self._dragging.origX + dx);
        pos.y = Math.max(5, self._dragging.origY + dy);
        self._renderSvg();
        self._attachDragHandlers();
      }
    });

    document.addEventListener('mouseup', () => {
      if (self._dragging) {
        self._dragging = null;
      }
    });
  },

  async _renderSqlInline(projectId) {
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
