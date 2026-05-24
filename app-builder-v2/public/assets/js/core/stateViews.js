'use strict';

const StateViews = {
  loading(container) {
    container.innerHTML = '<div class="loading-state"><div>Загрузка...</div></div>';
  },

  empty(container, text, actions) {
    let html = `<div class="empty-state"><div class="es-icon">📋</div><div class="es-text">${text}</div>`;
    if (actions && actions.length) {
      html += '<div class="es-actions">';
      for (const a of actions) {
        html += `<button class="btn btn-primary" data-action="${a.action}">${a.label}</button>`;
      }
      html += '</div>';
    }
    html += '</div>';
    container.innerHTML = html;
    Actions.scan(container);
  },

  error(container, message) {
    container.innerHTML = `<div class="error-state"><div class="es-message">${message}</div><button class="btn" onclick="location.reload()">Перезагрузить</button></div>`;
  },

  noAccess(container) {
    container.innerHTML = '<div class="no-access-state"><div class="es-icon">🔒</div><div>У вас нет доступа к этому разделу</div></div>';
  },
};

window.StateViews = StateViews;
