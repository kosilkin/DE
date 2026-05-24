'use strict';

const AppState = {
  currentScreen: 'start',
  currentProject: null,
  currentUser: null,
  currentEntityId: null,
  designerTab: 'overview',
};

const AppShell = {
  init() {
    this.headerEl = DOM.$('#app-header');
    this.sidebarEl = DOM.$('#sidebar');
    this.contentEl = DOM.$('#main-content');
    this.statusEl = DOM.$('#status-bar');
    this.navigate('start');
  },

  navigate(screen, params) {
    AppState.currentScreen = screen;
    DOM.hide(this.sidebarEl);
    this.updateHeader();

    switch (screen) {
      case 'start':
        StartScreen.render(this.contentEl);
        break;
      case 'designer':
        DOM.show(this.sidebarEl);
        DesignerShell.render(this.contentEl, this.sidebarEl, params);
        break;
      case 'runtime':
        DOM.show(this.sidebarEl);
        RuntimeShell.render(this.contentEl, this.sidebarEl, params);
        break;
    }

    this.updateStatus();
  },

  updateHeader() {
    const p = AppState.currentProject;
    let breadcrumb = '';
    let userInfo = '';
    let buttons = '';

    if (p) {
      breadcrumb = `<span class="app-breadcrumb">/ ${p.title}</span>`;
      if (AppState.currentScreen === 'designer') {
        breadcrumb += '<span class="app-breadcrumb"> / Конструктор</span>';
        buttons = '<button class="btn btn-sm" data-action="goRuntime">Режим пользователя</button> <button class="btn btn-sm" data-action="goStart">К проектам</button>';
      } else if (AppState.currentScreen === 'runtime') {
        breadcrumb += '<span class="app-breadcrumb"> / Пользовательский режим</span>';
        if (AppState.currentUser) {
          userInfo = `<span class="header-user">${AppState.currentUser.full_name || AppState.currentUser.login} (${AppState.currentUser.role_title || ''})</span>`;
          buttons = '<button class="btn btn-sm" data-action="runtimeLogout">Выйти</button>';
        }
        buttons += ' <button class="btn btn-sm" data-action="goDesigner">Конструктор</button> <button class="btn btn-sm" data-action="goStart">К проектам</button>';
      }
    }

    this.headerEl.innerHTML = `
      <span class="app-title">Конструктор ИС</span>
      ${breadcrumb}
      <span class="header-spacer"></span>
      ${userInfo}
      ${buttons}
    `;
    Actions.scan(this.headerEl);
  },

  updateStatus() {
    const s = AppState.currentScreen;
    const labels = { start: 'Стартовый экран', designer: 'Режим конструктора', runtime: 'Пользовательский режим' };
    this.statusEl.textContent = labels[s] || '';
  },

  setProject(project) {
    AppState.currentProject = project;
  },

  setUser(user) {
    AppState.currentUser = user;
  },
};

// Global actions
Actions.register('goStart', () => {
  AppState.currentProject = null;
  AppState.currentUser = null;
  AppShell.navigate('start');
});

Actions.register('goDesigner', () => {
  AppShell.navigate('designer');
});

Actions.register('goRuntime', () => {
  AppState.currentUser = null;
  AppShell.navigate('runtime');
});

window.AppState = AppState;
window.AppShell = AppShell;
