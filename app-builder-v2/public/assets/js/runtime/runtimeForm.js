'use strict';

const RuntimeForm = {
  async show(entityId, recordId, onSave) {
    const overlay = DOM.el('div', { className: 'modal-overlay' });
    const modal = DOM.el('div', { className: 'modal', style: { minWidth: '500px' } });
    modal.innerHTML = '<div class="loading-state">Загрузка...</div>';
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    try {
      const entity = await callApi(() => api.entities.get(entityId));
      const fields = await callApi(() => api.fields.list(entityId));
      let record = null;
      if (recordId) {
        record = await callApi(() => api.runtime.getRecord(entityId, recordId));
      }

      const isEdit = !!record;
      const esc = (s) => { const d = document.createElement('div'); d.textContent = String(s != null ? s : ''); return d.innerHTML; };

      let html = `<div class="modal-title">${isEdit ? 'Редактировать запись' : 'Создать запись'} — ${esc(entity.title)}</div>`;
      html += '<form id="record-form" class="record-form">';

      for (const f of fields) {
        if (f.is_system) continue;
        html += `<div class="form-group"><label>${esc(f.title)} ${f.required ? '<span style="color:var(--danger)">*</span>' : ''}</label>`;

        const val = record ? (record[f.name] != null ? record[f.name] : '') : (f.default_value || '');

        switch (f.type) {
          case 'text':
            html += `<input type="text" name="${f.name}" value="${esc(val)}" ${f.required ? 'required' : ''} />`;
            break;
          case 'number':
            html += `<input type="number" name="${f.name}" value="${esc(val)}" step="any" ${f.required ? 'required' : ''} />`;
            break;
          case 'date':
            html += `<input type="date" name="${f.name}" value="${esc(val)}" ${f.required ? 'required' : ''} />`;
            break;
          case 'datetime':
            html += `<input type="datetime-local" name="${f.name}" value="${esc(val)}" ${f.required ? 'required' : ''} />`;
            break;
          case 'boolean':
            html += `<label style="display:flex;align-items:center;gap:6px"><input type="checkbox" name="${f.name}" ${val ? 'checked' : ''} data-exempt="true" /> Да</label>`;
            break;
          case 'select': {
            let opts = [];
            try { opts = f.options_json ? JSON.parse(f.options_json) : []; } catch {}
            html += `<select name="${f.name}" ${f.required ? 'required' : ''}><option value="">— выберите —</option>`;
            for (const o of opts) html += `<option value="${esc(o)}" ${String(val) === String(o) ? 'selected' : ''}>${esc(o)}</option>`;
            html += '</select>';
            break;
          }
          case 'relation':
            html += `<select name="${f.name}" class="relation-select" data-field-name="${f.name}" ${f.required ? 'required' : ''}><option value="">Загрузка...</option></select>`;
            break;
          default:
            html += `<input type="text" name="${f.name}" value="${esc(val)}" />`;
        }
        html += '</div>';
      }

      html += '<div class="modal-actions">';
      html += '<button type="button" class="btn" data-exempt="true" id="form-cancel">Отмена</button>';
      html += `<button type="submit" class="btn btn-primary">${isEdit ? 'Сохранить' : 'Создать'}</button>`;
      html += '</div></form>';

      modal.innerHTML = html;

      DOM.$('#form-cancel', modal).onclick = () => overlay.remove();
      overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

      // Load relation options using actual relations data
      const relationFields = fields.filter(f => f.type === 'relation');
      if (relationFields.length) {
        const relations = await callApi(() => api.relations.list(AppState.currentProject.id));
        for (const rf of relationFields) {
          const sel = modal.querySelector(`select[data-field-name="${rf.name}"]`);
          if (!sel) continue;
          const rel = relations.find(r => r.source_field_id === rf.id);
          if (rel) {
            try {
              const options = await callApi(() => api.runtime.relationOptions(rel.target_entity_id, rel.target_display_field_id || undefined));
              sel.innerHTML = '<option value="">— выберите —</option>';
              for (const opt of options) {
                const selected = record && record[rf.name] == opt.id ? 'selected' : '';
                sel.innerHTML += `<option value="${opt.id}" ${selected}>${esc(opt.display)}</option>`;
              }
            } catch { sel.innerHTML = '<option value="">— ошибка загрузки —</option>'; }
          } else {
            sel.innerHTML = '<option value="">— связь не настроена —</option>';
          }
        }
      }

      DOM.$('#record-form', modal).onsubmit = async (e) => {
        e.preventDefault();
        const formData = {};
        for (const f of fields) {
          if (f.is_system) continue;
          if (f.type === 'boolean') {
            formData[f.name] = modal.querySelector(`input[name="${f.name}"]`).checked ? 1 : 0;
          } else {
            const input = modal.querySelector(`[name="${f.name}"]`);
            if (input) formData[f.name] = input.value;
          }
        }
        try {
          if (isEdit) {
            await callApi(() => api.runtime.updateRecord(entityId, recordId, formData));
            Notifications.success('Запись обновлена');
          } else {
            await callApi(() => api.runtime.createRecord(entityId, formData));
            Notifications.success('Запись создана');
          }
          overlay.remove();
          if (onSave) onSave();
        } catch (err) { Notifications.error(err.message); }
      };
    } catch (e) {
      modal.innerHTML = `<div class="error-state"><div class="es-message">${e.message}</div></div>`;
    }
  },
};

window.RuntimeForm = RuntimeForm;
