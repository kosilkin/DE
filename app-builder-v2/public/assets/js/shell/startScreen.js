'use strict';

const StartScreen = {
  async render(container) {
    StateViews.loading(container);
    try {
      const projects = await callApi(() => api.projects.list());
      this._renderList(container, projects);
    } catch (e) {
      StateViews.error(container, e.message);
    }
  },

  _renderList(container, projects) {
    let html = `
      <div class="start-screen">
        <h1>Проекты</h1>
        <p class="subtitle">Выберите проект или создайте новый</p>
        <div class="toolbar">
          <button class="btn btn-primary" data-action="createProject">Создать проект</button>
        </div>
    `;

    if (!projects.length) {
      html += '<div class="empty-state"><div class="es-icon">📁</div><div class="es-text">Проектов пока нет</div></div>';
    } else {
      html += '<div class="project-grid">';
      for (const p of projects) {
        html += `
          <div class="project-card" data-project-id="${p.id}">
            <div class="pc-title">${this._esc(p.title)}</div>
            <div class="pc-desc">${this._esc(p.description || 'Без описания')}</div>
            <div class="pc-meta">Создан: ${p.created_at ? p.created_at.substring(0, 10) : ''}</div>
            <div class="pc-actions">
              <button class="btn btn-sm btn-primary" data-action="openDesigner" data-params='{"id":${p.id}}'>Конструктор</button>
              <button class="btn btn-sm" data-action="openRuntime" data-params='{"id":${p.id}}'>Пользователь</button>
              <button class="btn btn-sm" data-action="editProject" data-params='{"id":${p.id}}'>Изменить</button>
              <button class="btn btn-sm btn-danger" data-action="deleteProject" data-params='{"id":${p.id}}'>Удалить</button>
            </div>
          </div>
        `;
      }
      html += '</div>';
    }

    html += '</div>';
    container.innerHTML = html;
    Actions.scan(container);
  },

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  },

  _showCreateModal(editProject) {
    const isEdit = !!editProject;
    const overlay = DOM.el('div', { className: 'modal-overlay' });
    const modal = DOM.el('div', { className: 'modal' });
    modal.innerHTML = `
      <div class="modal-title">${isEdit ? 'Редактировать проект' : 'Создать проект'}</div>
      <div class="form-group">
        <label>Название</label>
        <input type="text" id="project-title" value="${isEdit ? this._esc(editProject.title) : ''}" placeholder="Название проекта" />
      </div>
      <div class="form-group">
        <label>Описание</label>
        <textarea id="project-desc" placeholder="Описание проекта">${isEdit ? this._esc(editProject.description || '') : ''}</textarea>
      </div>
      ${!isEdit ? `
      <div class="form-group">
        <label>Шаблон</label>
        <select id="project-template">
          <option value="">Пустой проект</option>
          <option value="courses">Курсы и заявки</option>
        </select>
      </div>` : ''}
      <div class="modal-actions">
        <button class="btn" data-exempt="true" id="modal-cancel">Отмена</button>
        <button class="btn btn-primary" data-exempt="true" id="modal-save">${isEdit ? 'Сохранить' : 'Создать'}</button>
      </div>
    `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    DOM.$('#modal-cancel', modal).onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    DOM.$('#modal-save', modal).onclick = async () => {
      const title = DOM.$('#project-title', modal).value.trim();
      const description = DOM.$('#project-desc', modal).value.trim();
      if (!title) { Notifications.error('Название обязательно'); return; }
      try {
        if (isEdit) {
          await callApi(() => api.projects.update(editProject.id, { title, description }));
          Notifications.success('Проект обновлён');
        } else {
          const template_code = DOM.$('#project-template', modal) ? DOM.$('#project-template', modal).value : '';
          await callApi(() => api.projects.create({ title, description, template_code }));
          Notifications.success('Проект создан');
        }
        overlay.remove();
        StartScreen.render(DOM.$('#main-content'));
      } catch (e) {
        Notifications.error(e.message);
      }
    };
  },
};

Actions.register('createProject', () => StartScreen._showCreateModal());

Actions.register('editProject', async (params) => {
  const project = await callApi(() => api.projects.get(params.id));
  StartScreen._showCreateModal(project);
});

Actions.register('deleteProject', async (params) => {
  if (!confirm('Вы уверены? Все данные проекта будут удалены.')) return;
  try {
    await callApi(() => api.projects.delete(params.id));
    Notifications.success('Проект удалён');
    StartScreen.render(DOM.$('#main-content'));
  } catch (e) { Notifications.error(e.message); }
});

Actions.register('openDesigner', async (params) => {
  const project = await callApi(() => api.projects.get(params.id));
  AppShell.setProject(project);
  AppShell.navigate('designer');
});

Actions.register('openRuntime', async (params) => {
  const project = await callApi(() => api.projects.get(params.id));
  AppShell.setProject(project);
  AppShell.navigate('runtime');
});

window.StartScreen = StartScreen;
