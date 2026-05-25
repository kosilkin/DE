'use strict';

const Actions = {
  _registry: {},

  register(name, handler) {
    this._registry[name] = handler;
  },

  async execute(name, ...args) {
    const handler = this._registry[name];
    if (!handler) {
      console.warn(`Action not registered: ${name}`);
      return;
    }
    try {
      await handler(...args);
    } catch (e) {
      console.error(`Action error [${name}]:`, e);
      Notifications.error(e.message);
    }
  },

  scan(container) {
    // Event delegation handles all [data-action] clicks via the document-level listener.
    // scan() is kept for backwards compatibility but no longer binds individual handlers.
  },

  checkSuspiciousButtons(container) {
    const root = container || document;
    const buttons = root.querySelectorAll('button:not([disabled]):not([data-action]):not([type="submit"]):not([data-exempt])');
    const suspicious = [];
    buttons.forEach(btn => {
      if (!btn.onclick && !btn._actionBound && !btn.closest('form') && !btn.dataset.exempt) {
        suspicious.push(btn);
      }
    });
    return suspicious;
  },
};

window.Actions = Actions;

document.addEventListener('click', (e) => {
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'LABEL') return;
  const btn = e.target.closest('[data-action]');
  if (btn) {
    e.preventDefault();
    const action = btn.dataset.action;
    const params = btn.dataset.params ? JSON.parse(btn.dataset.params) : undefined;
    Actions.execute(action, params);
  }
});
