'use strict';

const ExportScreen = {
  render(container) {
    container.innerHTML = `
      <h2>Экспорт проекта</h2>
      <p style="color:var(--text-secondary);margin:8px 0 20px">Экспорт проекта в файловую систему: конфигурация, схема, ER-диаграмма, данные.</p>
      <div class="card" style="max-width:500px">
        <div class="card-title">Полный экспорт</div>
        <p style="margin-bottom:12px;color:var(--text-secondary)">Экспортирует:</p>
        <ul style="margin:0 0 16px 20px;color:var(--text-secondary);font-size:13px">
          <li>project.config.json</li>
          <li>schema.sql</li>
          <li>ER.svg</li>
          <li>data/*.json</li>
          <li>README.md</li>
        </ul>
        <button class="btn btn-primary" data-action="exportProjectFull">Экспортировать проект</button>
      </div>
      <div class="card" style="max-width:500px;margin-top:20px">
        <div class="card-title">Экспорт для разработчика</div>
        <p style="margin-bottom:12px;color:var(--text-secondary)">Полный экспорт проекта в один JSON-файл. Включает таблицы, поля, связи, роли, права, пользователей и все данные. Можно импортировать обратно на главной странице.</p>
        <button class="btn btn-primary" data-action="exportProjectDev">Экспорт для разработчика (.json)</button>
      </div>
      <div style="margin-top:20px">
        <h4 style="margin-bottom:8px">Отдельные экспорты</h4>
        <div style="display:flex;gap:8px">
          <button class="btn" data-action="exportSqlFile">Сохранить SQL</button>
          <button class="btn" data-action="exportErFile">Сохранить ER.svg</button>
        </div>
      </div>
      <div style="margin-top:30px;padding:16px;background:#f8f9fa;border-radius:var(--radius);border:1px solid var(--border)">
        <h4>Будущие экспорты (не в MVP)</h4>
        <ul style="margin:8px 0 0 20px;color:var(--text-secondary);font-size:13px">
          <li>Экспорт решения для ДЭ</li>
          <li>Экспорт в 1С (.dt, .cf)</li>
        </ul>
      </div>
    `;
    Actions.scan(container);
  },
};

Actions.register('exportProjectFull', async () => {
  try {
    const result = await callApi(() => api.export.project(AppState.currentProject.id));
    if (result) Notifications.success(`Проект экспортирован: ${result}`);
  } catch (e) { Notifications.error(e.message); }
});

Actions.register('exportProjectDev', async () => {
  try {
    const result = await callApi(() => api.export.projectDev(AppState.currentProject.id));
    if (result) Notifications.success(`Проект экспортирован: ${result}`);
  } catch (e) { Notifications.error(e.message); }
});

window.ExportScreen = ExportScreen;
